"""DoD 4.2: 10 textos (5 relevantes, 5 irrelevantes/duplicados) → so 5 avancam;
reenvio de relevante e bloqueado pelo cache de dedup."""
import pytest

from backend.app.pipeline.stage1_filter import COUNTER_KEY, Stage1Filter, content_hash, normalize_text

RELEVANT = [
    {"title": "Missile strike reported near border", "language": "en"},
    {"title": "Troops mobilization along the frontier", "language": "en"},
    {"title": "Naval vessel spotted in contested waters", "language": "en"},
    {"title": "Explosão atinge depósito de combustível", "language": "pt"},
    {"title": "Tropas avançam após bloqueio de estrada", "language": "pt"},
]
IRRELEVANT = [
    {"title": "Local bakery wins pastry award", "language": "en"},
    {"title": "New phone released this week", "language": "en"},
    {"title": "Festival de cinema anuncia vencedores", "language": "pt"},
]


async def test_five_of_ten_pass(fake_redis):
    stage = Stage1Filter(fake_redis)
    batch = RELEVANT + IRRELEVANT + [dict(RELEVANT[0]), dict(RELEVANT[1])]  # 2 duplicatas
    assert len(batch) == 10
    passed = [item for item in batch if await stage.process(dict(item)) is not None]
    assert len(passed) == 5

    counters = await fake_redis.hgetall(COUNTER_KEY)
    assert int(counters["passed"]) == 5
    assert int(counters["dropped_duplicate"]) == 2
    assert int(counters["dropped_no_keyword"]) == 3


async def test_resend_blocked_by_cache(fake_redis):
    stage = Stage1Filter(fake_redis)
    assert await stage.process(dict(RELEVANT[0])) is not None
    assert await stage.process(dict(RELEVANT[0])) is None  # SETNX ja ocupado


async def test_normalization_and_hash_stability():
    a = normalize_text("  Missile STRIKE, reported!!  ")
    b = normalize_text("missile strike reported")
    assert a == b
    assert content_hash("Missile STRIKE, reported!") == content_hash("missile strike reported")


async def test_output_carries_hash_and_language(fake_redis):
    stage = Stage1Filter(fake_redis)
    out = await stage.process({"title": "Blockade announced", "language": "EN-us"})
    assert out is not None
    assert out["language"] == "en"
    assert len(out["content_hash"]) == 64
