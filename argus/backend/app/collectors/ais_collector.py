"""Collector AIS via AISStream (WebSocket, chave gratis; modo mock sem chave).

Tipos de interesse: militar (35), tankers (80-89), cargo (70-79). Ultimas
posicoes por MMSI em hash Redis. P2 documentado (fora do v1): deteccao de
"dark ships" comparando com baseline historico de densidade.
"""
from __future__ import annotations

import asyncio
import json
import logging
import random
import time
from typing import Any

from backend.app.collectors.base import BaseCollector
from backend.app.core.config import load_yaml_config

logger = logging.getLogger("argus.collectors.ais")

POSITIONS_KEY = "argus:ais:positions"  # hash mmsi -> json {lat, lon, type, ts}
POSITIONS_TTL = 3600


def is_interesting_ship_type(ship_type: int | None) -> bool:
    if ship_type is None:
        return False
    return ship_type == 35 or 70 <= ship_type <= 89


class AISCollector(BaseCollector):
    source_type = "ais"

    async def collect(self, max_messages: int = 200, duration_seconds: float = 30.0) -> int:
        if not self.settings.aisstream_api_key:
            logger.info("AISSTREAM_API_KEY ausente; usando modo mock")
            return await self._collect_mock()
        return await self._collect_ws(max_messages, duration_seconds)

    async def _handle_position(self, message: dict[str, Any]) -> int:
        meta = message.get("MetaData", {})
        report = message.get("Message", {}).get("PositionReport", {})
        mmsi = meta.get("MMSI")
        lat, lon = report.get("Latitude"), report.get("Longitude")
        if mmsi is None or lat is None or lon is None:
            return 0
        ship_type = meta.get("ShipType")
        position = {"lat": lat, "lon": lon, "type": ship_type,
                    "name": (meta.get("ShipName") or "").strip(), "ts": time.time()}
        await self.redis.hset(POSITIONS_KEY, str(mmsi), json.dumps(position))
        await self.redis.expire(POSITIONS_KEY, POSITIONS_TTL)
        if is_interesting_ship_type(ship_type):
            await self.publish(
                {
                    "title": f"Embarcacao {position['name'] or mmsi} (tipo {ship_type})",
                    "summary": f"AIS: MMSI={mmsi} lat={lat:.3f} lon={lon:.3f}",
                    "source_name": "AISStream",
                    "source_url": "https://aisstream.io/",
                    "language": "en",
                    "lat": lat, "lon": lon,
                    "geo_confidence": 0.99,
                    "pre_qualified": True,
                }
            )
            return 1
        return 0

    async def _collect_ws(self, max_messages: int, duration_seconds: float) -> int:
        import websockets

        cfg = load_yaml_config("sources")["ais"]
        subscription = {
            "APIKey": self.settings.aisstream_api_key,
            "BoundingBoxes": [zone["box"] for zone in cfg["bounding_boxes"]],
            "FilterMessageTypes": ["PositionReport"],
        }
        published = 0
        backoff = 1.0
        deadline = time.monotonic() + duration_seconds
        while time.monotonic() < deadline:
            try:
                async with websockets.connect(cfg["url"], open_timeout=15) as ws:
                    await ws.send(json.dumps(subscription))
                    backoff = 1.0  # conexao ok: zera o backoff
                    for _ in range(max_messages):
                        if time.monotonic() >= deadline:
                            break
                        raw = await asyncio.wait_for(ws.recv(), timeout=10.0)
                        published += await self._handle_position(json.loads(raw))
            except Exception as exc:
                logger.warning("AIS ws caiu (%r); reconectando em %.1fs", exc, backoff)
                await asyncio.sleep(backoff)
                backoff = min(backoff * 2, 60.0)  # reconexao com backoff
        await self.touch_last_checked("AISStream")
        return published

    async def _collect_mock(self, n: int = 5) -> int:
        """Sem chave: gera posicoes plausiveis nas bounding boxes configuradas."""
        cfg = load_yaml_config("sources")["ais"]
        published = 0
        for zone in cfg["bounding_boxes"]:
            (lat1, lon1), (lat2, lon2) = zone["box"]
            for i in range(n):
                message = {
                    "MetaData": {"MMSI": 900000000 + published, "ShipType": random.choice([35, 70, 83]),
                                 "ShipName": f"MOCK {zone['name'].upper()} {i}"},
                    "Message": {"PositionReport": {
                        "Latitude": random.uniform(min(lat1, lat2), max(lat1, lat2)),
                        "Longitude": random.uniform(min(lon1, lon2), max(lon1, lon2)),
                    }},
                }
                published += await self._handle_position(message)
        await self.touch_last_checked("AISStream")
        return published
