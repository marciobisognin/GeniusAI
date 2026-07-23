"""Estagio 3: enriquecimento LLM + embedding + gravacao unica no Postgres.

A LLM sugere severidade; a decisao final e deterministica em Python
(corroboracao de fontes independentes OU zona de tensao configurada).
"""
from __future__ import annotations

import datetime as dt
import logging
import math
from typing import Any

import redis.asyncio as aioredis

from backend.app.llm.base import parse_structured
from backend.app.llm.router import LLMRouter
from backend.app.llm.schemas import EventEnrichment
from backend.app.queue.redis_queue import STREAM_TRIAGED, publish_to_stream

logger = logging.getLogger("argus.stage3")

# Zonas de tensao: eventos aqui dentro podem manter severidade alta sem 2a fonte.
TENSION_ZONES: list[dict[str, Any]] = [
    {"name": "Leste Europeu", "lat": 49.0, "lon": 32.0, "radius_km": 900},
    {"name": "Golfo Persico / Hormuz", "lat": 26.6, "lon": 53.0, "radius_km": 700},
    {"name": "Mar da China Meridional", "lat": 13.0, "lon": 113.5, "radius_km": 1200},
    {"name": "Estreito de Taiwan", "lat": 24.5, "lon": 119.5, "radius_km": 500},
    {"name": "Mar Vermelho / Bab-el-Mandeb", "lat": 14.0, "lon": 42.0, "radius_km": 800},
    {"name": "Levante", "lat": 32.5, "lon": 35.5, "radius_km": 500},
]

_SEVERITY_ORDER = ["low", "medium", "high", "critical"]

ENRICH_PROMPT = """Voce e um analista GEOINT. Analise o evento abaixo e responda SOMENTE com JSON:
{{"title": "titulo traduzido, SEMPRE em portugues do Brasil",
 "summary": "resumo objetivo em ate 3 frases, SEMPRE em portugues do Brasil",
 "category": "conflito|diplomacia|naval|aereo|humanitario|geofisico",
 "severity": "low|medium|high|critical",
 "confidence": 0.0-1.0,
 "is_inference": true|false,
 "actors": ["atores estatais/nao-estatais envolvidos"]}}

REGRAS:
- Os campos `title` e `summary` DEVEM estar sempre em portugues do Brasil
  (pt-BR), independentemente do idioma original da noticia. Se a fonte estiver
  em outro idioma (ingles, etc.), TRADUZA o titulo e o resumo para pt-BR. Nunca
  devolva title/summary no idioma original. Preserve nomes proprios, siglas e
  numeros; nao invente informacao ao traduzir.
- `is_inference` = true quando a classificacao depende de interpretacao sua e nao
  de fato explicito no texto. Nao invente fatos.

Titulo original: {title}
Texto: {summary}
Fonte: {source_name} (idioma original: {language})
"""


def ensure_source_url(item: dict) -> str:
    """Garante que todo evento carregue o link de acesso a fonte.

    Todos os collectors ja definem `source_url`; este e um cinto de seguranca:
    se vier vazio, tenta recuperar o link do `raw_data` da fonte.
    """
    url = (item.get("source_url") or "").strip()
    if url:
        return url
    raw = item.get("raw_data") or {}
    return (raw.get("url") or raw.get("link") or "").strip()


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = math.radians(lat2 - lat1), math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def in_tension_zone(lat: float | None, lon: float | None) -> str | None:
    if lat is None or lon is None:
        return None
    for zone in TENSION_ZONES:
        if _haversine_km(lat, lon, zone["lat"], zone["lon"]) <= zone["radius_km"]:
            return zone["name"]
    return None


def decide_severity(
    suggested: str,
    corroborating_sources: int,
    lat: float | None,
    lon: float | None,
) -> str:
    """Regra deterministica: `critical` exige >=2 fontes independentes OU zona de tensao.

    Sem corroboracao nem zona, rebaixa um nivel. A aritmetica fica aqui, nao na LLM.
    """
    if suggested not in _SEVERITY_ORDER:
        return "low"
    if suggested in ("low", "medium"):
        return suggested
    corroborated = corroborating_sources >= 2 or in_tension_zone(lat, lon) is not None
    if corroborated:
        return suggested
    return _SEVERITY_ORDER[_SEVERITY_ORDER.index(suggested) - 1]


class Stage3LLMEnrich:
    def __init__(
        self,
        redis: aioredis.Redis,
        router: LLMRouter | None = None,
        events_repo_factory: Any = None,
    ) -> None:
        self.redis = redis
        self.router = router or LLMRouter()
        self._repo_factory = events_repo_factory

    async def _repo(self) -> Any:
        if self._repo_factory is not None:
            return await self._repo_factory()
        from backend.app.db.repositories.events_repo import EventsRepository
        from backend.app.db.session import get_session_factory

        return EventsRepository(get_session_factory()())

    async def process(self, item: dict) -> dict | None:
        prompt = ENRICH_PROMPT.format(
            title=item.get("title", ""),
            summary=item.get("summary", ""),
            source_name=item.get("source_name", "?"),
            language=item.get("language", "en"),
        )
        result = await self.router.complete(
            prompt, json_schema=EventEnrichment.model_json_schema()
        )
        enrichment = parse_structured(result.text, EventEnrichment)

        embedding = await self.router.embed(
            f"{enrichment.title}\n{enrichment.summary}"  # embedding 100% em pt-BR
        )

        repo = await self._repo()
        corroborating = await repo.count_recent_similar_sources(embedding)
        severity = decide_severity(
            enrichment.severity, corroborating, item.get("lat"), item.get("lon")
        )

        confidence = enrichment.confidence
        if item.get("low_trust"):  # fontes sociais (Mastodon) entram rebaixadas
            confidence = min(confidence, 0.4)

        event_time = item.get("event_time")
        if isinstance(event_time, str):
            event_time = dt.datetime.fromisoformat(event_time)
        source_url = ensure_source_url(item)          # link de acesso sempre presente
        source_language = (item.get("language") or "en")[:8]  # idioma original (procedencia)
        original_title = item.get("title", "")[:2000]
        event_id = await repo.create_event(
            title=enrichment.title[:2000],            # titulo sempre em pt-BR (traduzido)
            original_title=original_title,            # titulo no idioma original (procedencia)
            summary=enrichment.summary,               # resumo sempre em pt-BR (traduzido)
            category=enrichment.category,
            severity=severity,
            confidence=confidence,
            is_inference=enrichment.is_inference or bool(item.get("low_trust")),
            event_time=event_time or dt.datetime.now(dt.timezone.utc),
            lat=item.get("lat"),
            lon=item.get("lon"),
            geo_confidence=item.get("geo_confidence"),
            country=item.get("country"),
            region=in_tension_zone(item.get("lat"), item.get("lon")),
            actors={"actors": enrichment.actors},
            source_name=item.get("source_name"),
            source_url=source_url,
            source_language=source_language,
            content_hash=item["content_hash"],
            raw_data=item.get("raw_data"),
            embedding=embedding,
        )
        if event_id is None:
            logger.info("evento duplicado no banco (content_hash); ignorado")
            return None

        triaged = {
            "event_id": event_id,
            "title": enrichment.title,                 # pt-BR
            "original_title": original_title,          # idioma original (procedencia)
            "summary": enrichment.summary,            # pt-BR
            "category": enrichment.category,
            "severity": severity,
            "confidence": confidence,
            "is_inference": enrichment.is_inference,
            "lat": item.get("lat"),
            "lon": item.get("lon"),
            "country": item.get("country"),
            "source_name": item.get("source_name"),
            "source_url": source_url,                 # link sempre presente
            "source_language": source_language,
            "corroborating_sources": corroborating,
        }
        await publish_to_stream(self.redis, STREAM_TRIAGED, triaged)
        return triaged
