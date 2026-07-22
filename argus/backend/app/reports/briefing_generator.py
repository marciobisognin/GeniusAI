"""Briefing diario em Markdown: fatos / inferencias / fontes, com confianca.

Agendado as 06:00 UTC (scheduler). Respeita o perfil LOCAL_ONLY do router.
Saida: data/reports/briefing_YYYY-MM-DD.md
"""
from __future__ import annotations

import datetime as dt
import logging
from pathlib import Path

from sqlalchemy import select

from backend.app.core.config import DATA_DIR
from backend.app.db.models import Event
from backend.app.llm.router import LLMRouter

logger = logging.getLogger("argus.briefing")

REPORTS_DIR = DATA_DIR / "reports"

_SEVERITY_RANK = {"critical": 0, "high": 1, "medium": 2, "low": 3, None: 4}

BRIEFING_PROMPT = """Voce e um analista GEOINT redigindo o briefing diario.
Com base SOMENTE nos eventos listados, escreva em Markdown (pt-BR):

## Sumario executivo
3-5 frases sobre o quadro global das ultimas 24h.

## Fatos
Somente o que esta explicito nos eventos. Cada item termina com (confianca: X.XX).

## Inferencias
Leituras analiticas suas, claramente separadas dos fatos. Cada item comeca com
"Avaliamos que..." e termina com (confianca: X.XX).

## Fontes
Lista de links unicos citados.

Nao invente eventos. Nao misture fato com inferencia.

EVENTOS (ultimas 24h, ordenados por severidade/regiao):
{events}
"""


def _format_event(event: Event) -> str:
    return (
        f"- [{event.severity or '?'}] ({event.region or event.country or 'global'}) "
        f"{event.title} — {event.summary or ''} "
        f"(confianca: {event.confidence if event.confidence is not None else '?'}; "
        f"inferencia: {event.is_inference}; fonte: {event.source_url or event.source_name})"
    )


async def generate_daily_briefing(
    router: LLMRouter | None = None,
    session: object = None,
    now: dt.datetime | None = None,
) -> Path:
    from backend.app.db.session import get_session_factory

    router = router or LLMRouter()
    now = now or dt.datetime.now(dt.timezone.utc)
    since = now - dt.timedelta(hours=24)

    own_session = session is None
    if own_session:
        session = get_session_factory()()
    try:
        result = await session.execute(
            select(Event).where(Event.event_time >= since).limit(500)
        )
        events = sorted(
            result.scalars().all(),
            key=lambda e: (_SEVERITY_RANK.get(e.severity, 4), e.region or "", e.country or ""),
        )
    finally:
        if own_session:
            await session.close()

    if events:
        body_input = "\n".join(_format_event(e) for e in events[:120])
        completion = await router.complete(BRIEFING_PROMPT.format(events=body_input))
        body = completion.text.strip()
    else:
        body = ("## Sumario executivo\nSem eventos registrados nas ultimas 24 horas.\n\n"
                "## Fatos\n(nenhum)\n\n## Inferencias\n(nenhuma)\n\n## Fontes\n(nenhuma)")

    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    path = REPORTS_DIR / f"briefing_{now:%Y-%m-%d}.md"
    header = (
        f"# Briefing diario ARGUS — {now:%Y-%m-%d}\n\n"
        f"> Gerado em {now.isoformat()} | eventos considerados: {len(events)}\n\n"
    )
    path.write_text(header + body + "\n", encoding="utf-8")
    logger.info("briefing salvo em %s", path)
    return path
