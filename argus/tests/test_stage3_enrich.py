"""Estagio 3 com router e repositorio fakes: item vira evento completo e
e publicado em stream:triaged_data."""
import json

import pytest

from backend.app.core.config import LLMProfile
from backend.app.llm.router import LLMRouter
from backend.app.pipeline.stage3_llm_enrich import Stage3LLMEnrich
from backend.app.queue.redis_queue import STREAM_TRIAGED
from tests.conftest import ScriptedProvider

ENRICH_JSON = (
    '{"summary": "Movimento naval no estreito.", "category": "naval",'
    ' "severity": "critical", "confidence": 0.9, "is_inference": false,'
    ' "actors": ["Iran Navy"]}'
)


class FakeRepo:
    def __init__(self, corroborating=0):
        self.created = []
        self.corroborating = corroborating

    async def count_recent_similar_sources(self, vector, hours=24, distance=0.2):
        return self.corroborating

    async def create_event(self, **fields):
        self.created.append(fields)
        return len(self.created)


@pytest.fixture
def router():
    return LLMRouter(
        providers={"ollama": ScriptedProvider("ollama", response=ENRICH_JSON)},
        profile=LLMProfile.LOCAL_ONLY,
    )


async def test_full_stage3_writes_event_and_publishes(fake_redis, router):
    repo = FakeRepo(corroborating=0)

    async def repo_factory():
        return repo

    stage = Stage3LLMEnrich(fake_redis, router=router, events_repo_factory=repo_factory)
    item = {
        "title": "Naval movement near Strait of Hormuz",
        "summary": "vessels observed",
        "content_hash": "a" * 64,
        "lat": 26.6, "lon": 56.5, "geo_confidence": 0.9,
        "source_name": "Reuters", "source_url": "https://example.org/x",
    }
    triaged = await stage.process(item)

    assert triaged is not None
    event = repo.created[0]
    assert event["category"] == "naval"
    assert len(event["embedding"]) == 768
    # em zona de tensao (Hormuz), critical se mantem mesmo sem 2a fonte
    assert event["severity"] == "critical"
    assert event["region"] is not None

    stream = fake_redis.streams[STREAM_TRIAGED]
    payload = json.loads(stream[0][1]["payload"])
    assert payload["event_id"] == 1 and payload["severity"] == "critical"


async def test_low_trust_source_reduces_confidence(fake_redis, router):
    repo = FakeRepo()

    async def repo_factory():
        return repo

    stage = Stage3LLMEnrich(fake_redis, router=router, events_repo_factory=repo_factory)
    await stage.process({
        "title": "rumor de ataque", "summary": "post social", "content_hash": "b" * 64,
        "low_trust": True, "lat": None, "lon": None,
    })
    event = repo.created[0]
    assert event["confidence"] <= 0.4
    assert event["is_inference"] is True


async def test_critical_without_corroboration_outside_zone_downgrades(fake_redis, router):
    repo = FakeRepo(corroborating=1)

    async def repo_factory():
        return repo

    stage = Stage3LLMEnrich(fake_redis, router=router, events_repo_factory=repo_factory)
    await stage.process({
        "title": "isolated report", "summary": "", "content_hash": "c" * 64,
        "lat": -30.0, "lon": -60.0,
    })
    assert repo.created[0]["severity"] == "high"
