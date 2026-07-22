"""Collector Mastodon/Fediverse: timelines publicas por hashtag, sem OAuth.

Fonte social = baixa confianca: itens saem marcados com `low_trust` (o Estagio 3
rebaixa `confidence` e favorece `is_inference`).
"""
from __future__ import annotations

import logging
import re

from backend.app.collectors.base import HTTP_RETRY, BaseCollector
from backend.app.core.config import load_yaml_config

logger = logging.getLogger("argus.collectors.mastodon")

_TAG_RE = re.compile(r"<[^>]+>")


def strip_html(html: str) -> str:
    return _TAG_RE.sub(" ", html).replace("&amp;", "&").strip()


class MastodonCollector(BaseCollector):
    source_type = "mastodon"

    async def collect(self) -> int:
        cfg = load_yaml_config("sources")["mastodon"]
        instance = self.settings.mastodon_instance.rstrip("/")
        count = 0
        for hashtag in cfg.get("hashtags", []):
            try:
                count += await self._collect_hashtag(instance, hashtag, int(cfg.get("limit", 40)))
            except Exception as exc:
                logger.warning("hashtag #%s falhou: %r", hashtag, exc)
        await self.touch_last_checked(f"Mastodon ({instance})")
        return count

    @HTTP_RETRY
    async def _collect_hashtag(self, instance: str, hashtag: str, limit: int) -> int:
        async with self.http_client() as client:
            resp = await client.get(
                f"{instance}/api/v1/timelines/tag/{hashtag}", params={"limit": limit}
            )
            resp.raise_for_status()
        count = 0
        for status in resp.json():
            text = strip_html(status.get("content", ""))
            if not text:
                continue
            await self.publish(
                {
                    "title": text[:140],
                    "summary": text,
                    "source_name": f"Mastodon #{hashtag}",
                    "source_url": status.get("url", ""),
                    "language": (status.get("language") or "en")[:2],
                    "event_time": status.get("created_at"),
                    "low_trust": True,  # OSINT social: confianca reduzida, inferencia favorecida
                }
            )
            count += 1
        return count
