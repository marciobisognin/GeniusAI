"""Redis Streams com consumer groups, XAUTOCLAIM e dead-letter."""
from __future__ import annotations

import json
import logging
from collections.abc import Awaitable, Callable
from typing import Any

import redis.asyncio as aioredis
from redis.exceptions import ResponseError

logger = logging.getLogger("argus.queue")

STREAM_RAW = "stream:raw_data"
STREAM_TRIAGED = "stream:triaged_data"
STREAM_ALERTS = "stream:alerts"
STREAM_DEAD_LETTER = "stream:dead_letter"

MAXLEN = 100_000
MAX_DELIVERIES = 3
IDLE_RECLAIM_MS = 5 * 60 * 1000  # readotar pendencias de workers mortos apos 5 min


async def publish_to_stream(
    redis: aioredis.Redis, stream: str, payload: dict[str, Any]
) -> str:
    """XADD com MAXLEN aproximado (poda barata)."""
    message_id = await redis.xadd(
        stream, {"payload": json.dumps(payload, ensure_ascii=False, default=str)},
        maxlen=MAXLEN, approximate=True,
    )
    return message_id


async def ensure_group(redis: aioredis.Redis, stream: str, group: str) -> None:
    try:
        await redis.xgroup_create(stream, group, id="0", mkstream=True)
    except ResponseError as exc:
        if "BUSYGROUP" not in str(exc):
            raise


async def _handle_message(
    redis: aioredis.Redis,
    stream: str,
    group: str,
    message_id: str,
    fields: dict[str, Any],
    handler: Callable[[dict[str, Any]], Awaitable[None]],
) -> None:
    payload = json.loads(fields["payload"])
    try:
        await handler(payload)
        await redis.xack(stream, group, message_id)
    except Exception as exc:
        deliveries = await _delivery_count(redis, stream, group, message_id)
        if deliveries >= MAX_DELIVERIES:
            await publish_to_stream(
                redis, STREAM_DEAD_LETTER,
                {"origin_stream": stream, "origin_id": message_id,
                 "error": repr(exc), "payload": payload},
            )
            await redis.xack(stream, group, message_id)
            logger.error("mensagem %s movida para dead-letter: %r", message_id, exc)
        else:
            logger.warning("falha %d/%d em %s: %r", deliveries, MAX_DELIVERIES, message_id, exc)


async def _delivery_count(
    redis: aioredis.Redis, stream: str, group: str, message_id: str
) -> int:
    pending = await redis.xpending_range(stream, group, message_id, message_id, 1)
    return int(pending[0]["times_delivered"]) if pending else 1


async def reclaim_stale(
    redis: aioredis.Redis, stream: str, group: str, consumer: str
) -> list[tuple[str, dict[str, Any]]]:
    """XAUTOCLAIM: readota mensagens pendentes de consumers mortos (idle > 5 min)."""
    _, claimed, _ = await redis.xautoclaim(
        stream, group, consumer, min_idle_time=IDLE_RECLAIM_MS, start_id="0", count=50
    )
    return claimed


async def consume_stream(
    redis: aioredis.Redis,
    stream: str,
    group: str,
    consumer: str,
    handler: Callable[[dict[str, Any]], Awaitable[None]],
    block_ms: int = 5000,
    max_iterations: int | None = None,
) -> None:
    """Loop de consumo: XREADGROUP → handler → XACK; reclaim periodico embutido."""
    await ensure_group(redis, stream, group)
    iterations = 0
    while max_iterations is None or iterations < max_iterations:
        iterations += 1
        for message_id, fields in await reclaim_stale(redis, stream, group, consumer):
            await _handle_message(redis, stream, group, message_id, fields, handler)
        response = await redis.xreadgroup(
            group, consumer, {stream: ">"}, count=20, block=block_ms
        )
        for _stream_name, messages in response or []:
            for message_id, fields in messages:
                await _handle_message(redis, stream, group, message_id, fields, handler)
