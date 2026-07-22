"""Collector de crises e geofisica: ReliefWeb, GDACS, USGS e NASA FIRMS."""
from __future__ import annotations

import csv
import io
import logging

import feedparser

from backend.app.collectors.base import HTTP_RETRY, BaseCollector
from backend.app.core.config import load_yaml_config

logger = logging.getLogger("argus.collectors.hazards")

_USGS_SEVERITY = [(7.0, "critical"), (6.0, "high"), (5.0, "medium")]


class HazardsCollector(BaseCollector):
    source_type = "hazards"

    async def collect(self) -> int:
        total = 0
        for fn in (self._reliefweb, self._gdacs, self._usgs, self._firms):
            try:
                total += await fn()
            except Exception as exc:
                logger.warning("%s falhou: %r", fn.__name__, exc)
        return total

    @HTTP_RETRY
    async def _reliefweb(self) -> int:
        cfg = load_yaml_config("sources")["reliefweb"]
        async with self.http_client() as client:
            resp = await client.get(
                cfg["url"],
                params={"appname": cfg["appname"], "limit": 20, "sort[]": "date:desc",
                        "fields[include][]": ["title", "url", "date", "primary_country",
                                              "country.location"]},
            )
            resp.raise_for_status()
        count = 0
        for item in resp.json().get("data", []):
            fields = item.get("fields", {})
            country = fields.get("primary_country", {})
            location = country.get("location") or {}
            await self.publish(
                {
                    "title": fields.get("title", ""),
                    "summary": fields.get("title", ""),
                    "source_name": "ReliefWeb",
                    "source_url": fields.get("url", ""),
                    "language": "en",
                    "event_time": (fields.get("date") or {}).get("original"),
                    "lat": location.get("lat"),
                    "lon": location.get("lon"),
                    "geo_confidence": 0.7 if location.get("lat") is not None else None,
                    "country": country.get("name"),
                    "pre_qualified": True,
                }
            )
            count += 1
        await self.touch_last_checked("ReliefWeb")
        return count

    @HTTP_RETRY
    async def _gdacs(self) -> int:
        cfg = load_yaml_config("sources")["gdacs"]
        async with self.http_client() as client:
            resp = await client.get(cfg["url"])
            resp.raise_for_status()
        parsed = feedparser.parse(resp.content)
        count = 0
        for entry in parsed.entries:
            lat = entry.get("geo_lat") or entry.get("where", {}).get("lat")
            lon = entry.get("geo_long") or entry.get("where", {}).get("lon")
            alert_level = (entry.get("gdacs_alertlevel") or "").lower()
            await self.publish(
                {
                    "title": entry.get("title", ""),
                    "summary": entry.get("summary", ""),
                    "source_name": "GDACS",
                    "source_url": entry.get("link", ""),
                    "language": "en",
                    "lat": float(lat) if lat else None,
                    "lon": float(lon) if lon else None,
                    "geo_confidence": 0.9 if lat else None,
                    "pre_qualified": True,
                    "raw_data": {"alert_level": alert_level,
                                 "event_type": entry.get("gdacs_eventtype")},
                }
            )
            count += 1
        await self.touch_last_checked("GDACS")
        return count

    @HTTP_RETRY
    async def _usgs(self) -> int:
        cfg = load_yaml_config("sources")["usgs"]
        async with self.http_client() as client:
            resp = await client.get(cfg["url"])
            resp.raise_for_status()
        count = 0
        for feature in resp.json().get("features", []):
            props = feature.get("properties", {})
            coords = (feature.get("geometry") or {}).get("coordinates") or [None, None]
            magnitude = float(props.get("mag") or 0.0)
            severity = next((s for m, s in _USGS_SEVERITY if magnitude >= m), "low")
            await self.publish(
                {
                    "title": props.get("title", ""),
                    "summary": f"Sismo M{magnitude} — {props.get('place', '?')}",
                    "source_name": "USGS",
                    "source_url": props.get("url", ""),
                    "language": "en",
                    "lat": coords[1],
                    "lon": coords[0],
                    "geo_confidence": 0.95,
                    "pre_qualified": True,
                    "raw_data": {"mag": magnitude, "suggested_severity": severity},
                }
            )
            count += 1
        await self.touch_last_checked("USGS")
        return count

    @HTTP_RETRY
    async def _firms(self) -> int:
        """NASA FIRMS exige chave gratuita; sem ela, degrada silenciosamente (0 itens)."""
        key = self.settings.firms_map_key
        if not key:
            logger.info("FIRMS_MAP_KEY ausente; pulando FIRMS (modo degradado)")
            return 0
        cfg = load_yaml_config("sources")["firms"]
        url = f"{cfg['url']}/{key}/{cfg['source']}/world/1"
        async with self.http_client(timeout=60.0) as client:
            resp = await client.get(url)
            resp.raise_for_status()
        count = 0
        reader = csv.DictReader(io.StringIO(resp.text))
        for row in reader:
            if float(row.get("confidence", "0") or 0) < 80:  # so anomalias de alta confianca
                continue
            await self.publish(
                {
                    "title": f"Anomalia termica {row.get('latitude')},{row.get('longitude')}",
                    "summary": f"FIRMS {cfg['source']} brilho={row.get('bright_ti4', '?')}",
                    "source_name": "NASA FIRMS",
                    "source_url": "https://firms.modaps.eosdis.nasa.gov/",
                    "language": "en",
                    "lat": float(row["latitude"]),
                    "lon": float(row["longitude"]),
                    "geo_confidence": 0.95,
                    "pre_qualified": True,
                }
            )
            count += 1
        await self.touch_last_checked("NASA FIRMS")
        return count
