"""Collector RSS/Atom: feedparser + httpx, com ETag/Last-Modified (cache condicional)."""
from __future__ import annotations

import datetime as dt
import logging
import time
from typing import Any

import feedparser

from backend.app.collectors.base import HTTP_RETRY, BaseCollector
from backend.app.core.config import load_yaml_config

logger = logging.getLogger("argus.collectors.rss")

CACHE_KEY = "argus:rss:http_cache"  # hash url -> "etag|last_modified"


class RSSCollector(BaseCollector):
    source_type = "rss"

    async def collect(self) -> int:
        feeds: list[dict[str, Any]] = load_yaml_config("sources").get("rss", [])
        published = 0
        for feed in feeds:
            try:
                published += await self._collect_feed(feed)
            except Exception as exc:
                logger.warning("feed %s falhou: %r", feed.get("name"), exc)
        return published

    @HTTP_RETRY
    async def _collect_feed(self, feed: dict[str, Any]) -> int:
        cached = await self.redis.hget(CACHE_KEY, feed["url"]) or "|"
        etag, last_modified = cached.split("|", 1)
        headers: dict[str, str] = {}
        if etag:
            headers["If-None-Match"] = etag
        if last_modified:
            headers["If-Modified-Since"] = last_modified

        async with self.http_client() as client:
            resp = await client.get(feed["url"], headers=headers)
        if resp.status_code == 304:  # nada novo
            return 0
        resp.raise_for_status()
        await self.redis.hset(
            CACHE_KEY, feed["url"],
            f"{resp.headers.get('ETag', '')}|{resp.headers.get('Last-Modified', '')}",
        )

        parsed = feedparser.parse(resp.content)
        count = 0
        for entry in parsed.entries:
            event_time = None
            struct = entry.get("published_parsed") or entry.get("updated_parsed")
            if struct:
                event_time = dt.datetime.fromtimestamp(
                    time.mktime(struct), tz=dt.timezone.utc
                ).isoformat()
            await self.publish(
                {
                    "title": entry.get("title", ""),
                    "summary": entry.get("summary", ""),  # v1: sem scraping do artigo
                    "source_name": feed["name"],
                    "source_url": entry.get("link", feed["url"]),
                    "language": feed.get("language", "en"),
                    "event_time": event_time,
                }
            )
            count += 1
        await self.touch_last_checked(feed["name"])
        logger.info("rss %s: %d itens", feed["name"], count)
        return count
