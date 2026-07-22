"""Motor de alertas: regras deterministicas + supressao com cooldown de 1h.

Regras v1: severidade critical; evento dentro de zona de tensao.
P2 (documentado, fora do v1): anomalia naval (dark ships vs. baseline).
Cooldown por chave `regra+regiao` via Redis SET NX EX 3600.
"""
from __future__ import annotations

import logging
from typing import Any

import redis.asyncio as aioredis

from backend.app.pipeline.stage3_llm_enrich import in_tension_zone
from backend.app.queue.redis_queue import STREAM_ALERTS, STREAM_TRIAGED, consume_stream, publish_to_stream

logger = logging.getLogger("argus.alerts")

COOLDOWN_SECONDS = 3600


class AlertEngine:
    def __init__(self, redis: aioredis.Redis, alerts_repo: Any = None) -> None:
        self.redis = redis
        self._repo = alerts_repo

    def evaluate_rules(self, event: dict[str, Any]) -> list[str]:
        """Retorna nomes das regras disparadas (deterministico, sem LLM)."""
        rules: list[str] = []
        if event.get("severity") == "critical":
            rules.append("critical_severity")
        zone = in_tension_zone(event.get("lat"), event.get("lon"))
        if zone is not None and event.get("severity") in ("high", "critical"):
            rules.append(f"tension_zone:{zone}")
        return rules

    def _region_key(self, event: dict[str, Any]) -> str:
        lat, lon = event.get("lat"), event.get("lon")
        if lat is None or lon is None:
            return event.get("country") or "global"
        # celula de ~1 grau: eventos vizinhos compartilham cooldown
        return f"{round(float(lat))}:{round(float(lon))}"

    async def process(self, event: dict[str, Any]) -> list[dict[str, Any]]:
        fired: list[dict[str, Any]] = []
        for rule in self.evaluate_rules(event):
            cooldown_key = f"argus:alert_cooldown:{rule}:{self._region_key(event)}"
            acquired = await self.redis.set(cooldown_key, "1", nx=True, ex=COOLDOWN_SECONDS)
            if not acquired:
                logger.info("alerta %s suprimido (cooldown 1h)", rule)
                continue
            alert = {
                "event_id": event.get("event_id"),
                "rule_name": rule,
                "severity": event.get("severity", "high"),
                "title": event.get("title"),
                "lat": event.get("lat"),
                "lon": event.get("lon"),
                "channel": "api",
            }
            await self._persist(alert)
            await publish_to_stream(self.redis, STREAM_ALERTS, alert)
            fired.append(alert)
        return fired

    async def _persist(self, alert: dict[str, Any]) -> None:
        if self._repo is not None:
            await self._repo(alert)
            return
        try:
            from backend.app.db.models import Alert
            from backend.app.db.session import get_session_factory

            async with get_session_factory()() as session:
                session.add(Alert(
                    event_id=alert["event_id"], rule_name=alert["rule_name"],
                    severity=alert["severity"], channel=alert["channel"], sent=True,
                ))
                await session.commit()
        except Exception as exc:
            logger.warning("alerta nao persistido: %r", exc)


async def run_alert_worker(worker_id: str = "alerts-1") -> None:
    from backend.app.core.config import get_settings

    redis = aioredis.from_url(get_settings().redis_url, decode_responses=True)
    engine = AlertEngine(redis)

    async def handle(payload: dict[str, Any]) -> None:
        await engine.process(payload)

    await consume_stream(redis, STREAM_TRIAGED, "alerts", worker_id, handle)
