"""Workers do pipeline: liga os estagios aos streams."""
from __future__ import annotations

import asyncio
import logging

import redis.asyncio as aioredis

from backend.app.core.config import get_settings
from backend.app.queue.redis_queue import STREAM_RAW, consume_stream

logger = logging.getLogger("argus.workers")


async def run_pipeline_workers(worker_id: str = "worker-1") -> None:
    """Consome stream:raw_data e atravessa os 3 estagios (E1→E2→E3)."""
    from backend.app.pipeline.stage1_filter import Stage1Filter
    from backend.app.pipeline.stage2_geo_ner import Stage2GeoNER
    from backend.app.pipeline.stage3_llm_enrich import Stage3LLMEnrich

    redis = aioredis.from_url(get_settings().redis_url, decode_responses=True)
    stage1 = Stage1Filter(redis)
    stage2 = Stage2GeoNER()
    stage3 = Stage3LLMEnrich(redis)

    async def handle(payload: dict) -> None:
        item = await stage1.process(payload)
        if item is None:
            return
        item = await stage2.process(item)
        if item is None:
            return
        await stage3.process(item)

    logger.info("worker %s consumindo %s", worker_id, STREAM_RAW)
    await consume_stream(redis, STREAM_RAW, "triage", worker_id, handle)


if __name__ == "__main__":
    asyncio.run(run_pipeline_workers())
