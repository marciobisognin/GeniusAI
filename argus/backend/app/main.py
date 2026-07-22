"""Aplicacao FastAPI: saude, API v1, WebSocket e frontend estatico."""
from __future__ import annotations

import contextlib
import logging
from collections.abc import AsyncIterator
from pathlib import Path

import redis.asyncio as aioredis
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from backend.app.core.config import get_settings

logger = logging.getLogger("argus")

FRONTEND_DIR = Path(__file__).resolve().parents[2] / "frontend"


@contextlib.asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    app.state.redis = aioredis.from_url(settings.redis_url, decode_responses=True)
    scheduler = None
    try:
        from backend.app.scheduler import build_scheduler

        scheduler = build_scheduler(app.state.redis)
        scheduler.start()
        logger.info("Agendador iniciado")
    except Exception:  # pragma: no cover - agendador e opcional em dev/teste
        logger.exception("Agendador nao iniciado; API segue funcional")
    try:
        yield
    finally:
        if scheduler is not None:
            scheduler.shutdown(wait=False)
        await app.state.redis.aclose()


app = FastAPI(title="ARGUS — Monitoramento Geopolitico Global", lifespan=lifespan)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/health/deep")
async def health_deep() -> dict[str, str]:
    """Checa Postgres e Redis; degrada com detalhe por dependencia."""
    result = {"status": "ok", "postgres": "ok", "redis": "ok"}
    try:
        from backend.app.db.session import get_engine

        async with get_engine().connect() as conn:
            await conn.execute(text("SELECT 1"))
    except Exception as exc:
        result["postgres"] = f"error: {exc}"
        result["status"] = "degraded"
    try:
        await app.state.redis.ping()
    except Exception as exc:
        result["redis"] = f"error: {exc}"
        result["status"] = "degraded"
    return result


def _mount_api(app: FastAPI) -> None:
    from backend.app.api.v1 import alerts, events, llm, map as map_api, websockets

    app.include_router(events.router, prefix="/api/v1/events", tags=["events"])
    app.include_router(map_api.router, prefix="/api/v1/map", tags=["map"])
    app.include_router(alerts.router, prefix="/api/v1/alerts", tags=["alerts"])
    app.include_router(llm.router, prefix="/api/v1/llm", tags=["llm"])
    app.include_router(websockets.router, tags=["ws"])


_mount_api(app)

if FRONTEND_DIR.exists():
    app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
