"""Collector GDELT 2.0 (DOC + GEO) — livre, sem chave, granularidade de 15 min."""
from __future__ import annotations

import logging
from typing import Any

from backend.app.collectors.base import HTTP_RETRY, BaseCollector
from backend.app.core.config import load_yaml_config

logger = logging.getLogger("argus.collectors.gdelt")


class GDELTCollector(BaseCollector):
    source_type = "gdelt"

    @HTTP_RETRY
    async def collect(self) -> int:
        cfg = load_yaml_config("sources")["gdelt"]
        count = 0
        async with self.http_client() as client:
            doc = await client.get(
                cfg["doc_url"],
                params={"query": cfg["query"], "mode": "ArtList",
                        "format": "json", "timespan": "30min", "maxrecords": 75},
            )
            doc.raise_for_status()
            for article in doc.json().get("articles", []):
                await self.publish(self._doc_to_item(article))
                count += 1

            geo = await client.get(
                cfg["geo_url"],
                params={"query": cfg["query"], "format": "GeoJSON", "timespan": "30min"},
            )
            geo.raise_for_status()
            for feature in geo.json().get("features", []):
                item = self._geo_to_item(feature)
                if item:
                    await self.publish(item)
                    count += 1
        await self.touch_last_checked("GDELT")
        logger.info("gdelt: %d itens", count)
        return count

    def _doc_to_item(self, article: dict[str, Any]) -> dict[str, Any]:
        return {
            "title": article.get("title", ""),
            "summary": article.get("title", ""),
            "source_name": f"GDELT/{article.get('domain', 'doc')}",
            "source_url": article.get("url", ""),
            "language": (article.get("language", "english")[:2] or "en").lower(),
            "event_time": article.get("seendate"),
            "raw_data": article,
        }

    def _geo_to_item(self, feature: dict[str, Any]) -> dict[str, Any] | None:
        geometry = feature.get("geometry") or {}
        props = feature.get("properties") or {}
        coords = geometry.get("coordinates")
        if not coords or len(coords) < 2:
            return None
        # GDELT GEO ja vem geolocalizado: pula a resolucao do Estagio 2.
        return {
            "title": props.get("name", "GDELT geo event"),
            "summary": props.get("html", "")[:1000],
            "source_name": "GDELT/geo",
            "source_url": props.get("shareimage", ""),
            "language": "en",
            "lat": float(coords[1]),
            "lon": float(coords[0]),
            "geo_confidence": 0.85,
            "raw_data": props,
        }
