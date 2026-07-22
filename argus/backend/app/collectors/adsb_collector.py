"""Collector ADS-B via adsb.lol v2 (aberto, comunitario, NAO filtra militares).

Limite ~1 req/s respeitado com espera explicita entre chamadas. Ultimas
posicoes por hex ICAO24 ficam em hash Redis com TTL.
"""
from __future__ import annotations

import asyncio
import json
import logging
import time

from backend.app.collectors.base import HTTP_RETRY, BaseCollector
from backend.app.core.config import load_yaml_config

logger = logging.getLogger("argus.collectors.adsb")

POSITIONS_KEY = "argus:adsb:positions"  # hash hex -> json {lat, lon, callsign, ts}
POSITIONS_TTL = 3600
MILITARY_FLAGS = {"dbFlags"}  # adsb.lol marca militar via dbFlags bit 0


def is_military(aircraft: dict) -> bool:
    return bool(int(aircraft.get("dbFlags", 0)) & 1)


class ADSBCollector(BaseCollector):
    source_type = "adsb"

    async def collect(self) -> int:
        cfg = load_yaml_config("sources")["adsb"]
        min_interval = 1.0 / float(cfg.get("rate_limit_rps", 1))
        count = 0
        last_call = 0.0
        for zone in cfg.get("zones", []):
            wait = min_interval - (time.monotonic() - last_call)
            if wait > 0:
                await asyncio.sleep(wait)  # respeita ~1 req/s da API comunitaria
            last_call = time.monotonic()
            try:
                count += await self._collect_zone(cfg["base_url"], zone)
            except Exception as exc:
                logger.warning("zona %s falhou: %r", zone.get("name"), exc)
        await self.touch_last_checked("adsb.lol")
        return count

    @HTTP_RETRY
    async def _collect_zone(self, base_url: str, zone: dict) -> int:
        async with self.http_client() as client:
            resp = await client.get(
                f"{base_url}/point/{zone['lat']}/{zone['lon']}/{zone['radius_nm']}"
            )
            resp.raise_for_status()
        aircraft_list = resp.json().get("ac") or []
        count = 0
        for ac in aircraft_list:
            hexcode = ac.get("hex")
            lat, lon = ac.get("lat"), ac.get("lon")
            if not hexcode or lat is None or lon is None:
                continue
            position = {
                "lat": lat, "lon": lon,
                "callsign": (ac.get("flight") or "").strip(),
                "alt": ac.get("alt_baro"), "military": is_military(ac),
                "ts": time.time(),
            }
            await self.redis.hset(POSITIONS_KEY, hexcode, json.dumps(position))
            await self.redis.expire(POSITIONS_KEY, POSITIONS_TTL)
            # So aeronaves de interesse (militares) viram item do pipeline;
            # o resto fica apenas na camada de posicoes ao vivo do mapa.
            if is_military(ac):
                await self.publish(
                    {
                        "title": f"Aeronave militar {position['callsign'] or hexcode}"
                                 f" sobre {zone['name']}",
                        "summary": f"ADS-B: hex={hexcode} alt={position['alt']}"
                                   f" zona={zone['name']}",
                        "source_name": "adsb.lol",
                        "source_url": f"https://globe.adsb.lol/?icao={hexcode}",
                        "language": "en",
                        "lat": lat, "lon": lon,
                        "geo_confidence": 0.99,
                        "pre_qualified": True,
                        "raw_data": ac,
                    }
                )
                count += 1
        logger.info("adsb %s: %d aeronaves, %d militares publicadas",
                    zone["name"], len(aircraft_list), count)
        return count
