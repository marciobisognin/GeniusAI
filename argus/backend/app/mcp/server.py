"""Servidor MCP somente leitura (FastMCP, transporte stdio).

Uso com Claude Code / Inspector:
    python -m backend.app.mcp.server
"""
from __future__ import annotations

from typing import Any

from mcp.server.fastmcp import FastMCP

mcp = FastMCP("argus-geoint")


def _event_to_dict(event: Any) -> dict[str, Any]:
    return {
        "id": event.id,
        "title": event.title,                    # traduzido para pt-BR (sempre)
        "original_title": event.original_title,  # idioma original (procedencia)
        "summary": event.summary,
        "category": event.category,
        "severity": event.severity,
        "confidence": event.confidence,
        "is_inference": event.is_inference,
        "event_time": event.event_time.isoformat() if event.event_time else None,
        "country": event.country,
        "region": event.region,
        "source_name": event.source_name,
        "source_url": event.source_url,
    }


@mcp.tool()
async def get_recent_events(limit: int = 20, category: str | None = None) -> list[dict[str, Any]]:
    """Lista os eventos geopoliticos mais recentes (opcionalmente por categoria)."""
    from backend.app.db.repositories.events_repo import EventsRepository
    from backend.app.db.session import get_session_factory

    async with get_session_factory()() as session:
        events = await EventsRepository(session).list_recent(limit=limit, category=category)
    return [_event_to_dict(e) for e in events]


@mcp.tool()
async def search_events_by_region(lat: float, lon: float, radius_km: float) -> list[dict[str, Any]]:
    """Busca eventos num raio (km) em torno de um ponto (PostGIS ST_DWithin)."""
    from backend.app.db.repositories.events_repo import EventsRepository
    from backend.app.db.session import get_session_factory

    async with get_session_factory()() as session:
        events = await EventsRepository(session).find_events_by_radius(lat, lon, radius_km)
    return [_event_to_dict(e) for e in events]


@mcp.tool()
async def run_rag_query(query: str) -> dict[str, Any]:
    """Pergunta em linguagem natural respondida via RAG (pgvector), com fontes."""
    from backend.app.analysis.rag import RAGService
    from backend.app.db.repositories.events_repo import EventsRepository
    from backend.app.db.session import get_session_factory

    async with get_session_factory()() as session:
        return await RAGService(EventsRepository(session)).query_rag(query)


if __name__ == "__main__":
    mcp.run(transport="stdio")
