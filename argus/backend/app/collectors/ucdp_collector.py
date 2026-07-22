"""Collector UCDP GED (conflito armado, CC-BY, sem restricao de licenca)."""
from __future__ import annotations

import logging

from backend.app.collectors.base import HTTP_RETRY, BaseCollector
from backend.app.core.config import load_yaml_config

logger = logging.getLogger("argus.collectors.ucdp")


class UCDPCollector(BaseCollector):
    source_type = "ucdp"

    @HTTP_RETRY
    async def collect(self) -> int:
        cfg = load_yaml_config("sources")["ucdp"]
        count = 0
        async with self.http_client(timeout=60.0) as client:
            resp = await client.get(cfg["url"], params={"pagesize": cfg["page_size"], "page": 0})
            resp.raise_for_status()
        for row in resp.json().get("Result", []):
            # UCDP ja vem geolocalizado — marca geo_confidence da fonte.
            await self.publish(
                {
                    "title": f"Conflito armado: {row.get('side_a', '?')} x {row.get('side_b', '?')}"
                             f" em {row.get('where_coordinates', row.get('country', '?'))}",
                    "summary": row.get("source_headline") or row.get("source_article", ""),
                    "source_name": "UCDP",
                    "source_url": "https://ucdp.uu.se/",
                    "language": "en",
                    "event_time": row.get("date_start"),
                    "lat": float(row["latitude"]) if row.get("latitude") else None,
                    "lon": float(row["longitude"]) if row.get("longitude") else None,
                    "geo_confidence": 0.9 if row.get("latitude") else None,
                    "pre_qualified": True,  # fonte curada de conflito: nao depende de keyword
                    "raw_data": {"deaths_best": row.get("best"), "type": row.get("type_of_violence")},
                }
            )
            count += 1
        await self.touch_last_checked("UCDP")
        logger.info("ucdp: %d itens", count)
        return count
