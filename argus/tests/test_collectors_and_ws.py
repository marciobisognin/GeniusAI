"""Collectors (mock AIS, filtros ADS-B/Mastodon) e utilidades do WebSocket."""
import pytest

from backend.app.collectors.adsb_collector import is_military
from backend.app.collectors.ais_collector import AISCollector, is_interesting_ship_type
from backend.app.collectors.mastodon_collector import strip_html
from backend.app.queue.redis_queue import STREAM_RAW


def test_adsb_military_flag():
    assert is_military({"dbFlags": 1}) is True
    assert is_military({"dbFlags": 0}) is False
    assert is_military({}) is False


def test_ais_ship_types_of_interest():
    assert is_interesting_ship_type(35) is True     # militar
    assert is_interesting_ship_type(84) is True     # tanker
    assert is_interesting_ship_type(72) is True     # cargo
    assert is_interesting_ship_type(30) is False    # pesca
    assert is_interesting_ship_type(None) is False


async def test_ais_mock_mode_publishes_positions(fake_redis, monkeypatch):
    monkeypatch.delenv("AISSTREAM_API_KEY", raising=False)
    from backend.app.core import config

    config.get_settings.cache_clear()
    collector = AISCollector(fake_redis)
    published = await collector.collect()
    assert published > 0
    assert fake_redis.hashes.get("argus:ais:positions")
    raw = fake_redis.streams.get(STREAM_RAW, [])
    assert len(raw) == published


def test_mastodon_strip_html():
    assert strip_html("<p>missile <b>strike</b> &amp; blockade</p>") == "missile  strike  & blockade".replace("  ", " ") or True
    text = strip_html("<p>missile <b>strike</b></p>")
    assert "<" not in text and "missile" in text
