"""Agendamento com APScheduler (AsyncIO) + lock distribuido no Redis.

Jobs: RSS 10 min, GDELT/UCDP 15 min, hazards 15 min, ADS-B/AIS continuos,
briefing diario 06:00 UTC, manutencao XAUTOCLAIM 5 min.
"""
from __future__ import annotations

import logging
from collections.abc import Awaitable, Callable

import redis.asyncio as aioredis
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

logger = logging.getLogger("argus.scheduler")

LOCK_TTL = 15 * 60


def with_lock(
    redis: aioredis.Redis, name: str, fn: Callable[[], Awaitable[object]]
) -> Callable[[], Awaitable[None]]:
    """Lock distribuido (SET NX EX): impede execucao dupla entre processos."""

    async def runner() -> None:
        token = await redis.set(f"argus:lock:{name}", "1", nx=True, ex=LOCK_TTL)
        if not token:
            logger.info("job %s ja em execucao em outro processo; pulando", name)
            return
        logger.info("job %s: inicio", name)
        try:
            result = await fn()
            logger.info("job %s: fim (%r)", name, result)
        except Exception:
            logger.exception("job %s falhou", name)
        finally:
            await redis.delete(f"argus:lock:{name}")

    return runner


def build_scheduler(redis: aioredis.Redis) -> AsyncIOScheduler:
    from backend.app.collectors.adsb_collector import ADSBCollector
    from backend.app.collectors.ais_collector import AISCollector
    from backend.app.collectors.gdelt_collector import GDELTCollector
    from backend.app.collectors.hazards_collector import HazardsCollector
    from backend.app.collectors.mastodon_collector import MastodonCollector
    from backend.app.collectors.rss_collector import RSSCollector
    from backend.app.collectors.ucdp_collector import UCDPCollector
    from backend.app.queue.redis_queue import STREAM_RAW, reclaim_stale
    from backend.app.reports.briefing_generator import generate_daily_briefing

    scheduler = AsyncIOScheduler(timezone="UTC")

    jobs: list[tuple[str, Callable[[], Awaitable[object]], IntervalTrigger | CronTrigger]] = [
        ("rss", RSSCollector(redis).collect, IntervalTrigger(minutes=10)),
        ("gdelt", GDELTCollector(redis).collect, IntervalTrigger(minutes=15)),
        ("ucdp", UCDPCollector(redis).collect, IntervalTrigger(minutes=15)),
        ("hazards", HazardsCollector(redis).collect, IntervalTrigger(minutes=15)),
        ("mastodon", MastodonCollector(redis).collect, IntervalTrigger(minutes=10)),
        # "Continuos": rodadas curtas frequentes (cada rodada respeita 1 req/s)
        ("adsb", ADSBCollector(redis).collect, IntervalTrigger(seconds=60)),
        ("ais", AISCollector(redis).collect, IntervalTrigger(seconds=60)),
        ("briefing", generate_daily_briefing, CronTrigger(hour=6, minute=0)),
    ]
    for name, fn, trigger in jobs:
        scheduler.add_job(with_lock(redis, name, fn), trigger, id=name,
                          max_instances=1, coalesce=True)

    async def maintenance() -> int:
        claimed = await reclaim_stale(redis, STREAM_RAW, "triage", "maintenance")
        return len(claimed)

    scheduler.add_job(with_lock(redis, "xautoclaim", maintenance),
                      IntervalTrigger(minutes=5), id="xautoclaim", max_instances=1)
    return scheduler
