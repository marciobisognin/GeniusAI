"""Base dos collectors: HTTP identificado, timeout, retry e publicacao na fila."""
from __future__ import annotations

import abc
import datetime as dt
import logging
from typing import Any

import httpx
import redis.asyncio as aioredis
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from backend.app.core.config import get_settings
from backend.app.queue.redis_queue import STREAM_RAW, publish_to_stream

logger = logging.getLogger("argus.collectors")

HTTP_RETRY = retry(
    retry=retry_if_exception_type(httpx.TransportError),
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=2, max=30),
    reraise=True,
)


class BaseCollector(abc.ABC):
    source_type: str = "generic"

    def __init__(self, redis: aioredis.Redis) -> None:
        self.redis = redis
        self.settings = get_settings()

    def http_client(self, timeout: float | None = None) -> httpx.AsyncClient:
        return httpx.AsyncClient(
            timeout=timeout or self.settings.http_timeout_seconds,
            headers={"User-Agent": self.settings.user_agent},
            follow_redirects=True,
        )

    async def publish(self, item: dict[str, Any]) -> None:
        item.setdefault("source_type", self.source_type)
        item.setdefault("collected_at", dt.datetime.now(dt.timezone.utc).isoformat())
        await publish_to_stream(self.redis, STREAM_RAW, item)

    async def touch_last_checked(self, source_name: str) -> None:
        """Atualiza sources.last_checked; silencioso se o banco estiver fora."""
        try:
            import sqlalchemy as sa

            from backend.app.db.models import Source
            from backend.app.db.session import get_session_factory

            async with get_session_factory()() as session:
                await session.execute(
                    sa.update(Source)
                    .where(Source.name == source_name)
                    .values(last_checked=dt.datetime.now(dt.timezone.utc))
                )
                await session.commit()
        except Exception as exc:
            logger.debug("last_checked nao atualizado (%s): %r", source_name, exc)

    @abc.abstractmethod
    async def collect(self) -> int:
        """Executa uma rodada de coleta; retorna quantos itens publicou."""
