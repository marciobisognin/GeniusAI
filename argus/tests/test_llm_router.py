"""DoD 3.3: em HYBRID, falha do Ollama aciona o secundario e audita;
em LOCAL_ONLY nenhuma chamada cloud ocorre."""
import pytest

from backend.app.core.config import LLMProfile
from backend.app.llm.base import parse_structured
from backend.app.llm.router import AllProvidersFailedError, LLMRouter
from backend.app.llm.schemas import EventEnrichment
from tests.conftest import ScriptedProvider

VALID_JSON = (
    '{"summary": "resumo", "category": "naval", "severity": "high",'
    ' "confidence": 0.8, "is_inference": false, "actors": ["IRGC"]}'
)


def make_router(profile, providers, sink=None):
    return LLMRouter(providers=providers, profile=profile, audit_sink=sink)


async def test_hybrid_falls_back_and_audits():
    audits = []

    async def sink(**fields):
        audits.append(fields)

    ollama = ScriptedProvider("ollama", fail=True)
    openrouter = ScriptedProvider("openrouter", response=VALID_JSON)
    router = make_router(LLMProfile.HYBRID, {"ollama": ollama, "openrouter": openrouter}, sink)

    result = await router.complete("analise")
    assert result.provider == "openrouter"
    assert ollama.complete_calls == 1 and openrouter.complete_calls == 1
    assert [a["success"] for a in audits] == [False, True]


async def test_local_only_never_calls_cloud():
    ollama = ScriptedProvider("ollama", fail=True)
    cloud = ScriptedProvider("openrouter", response=VALID_JSON)
    router = make_router(LLMProfile.LOCAL_ONLY, {"ollama": ollama, "openrouter": cloud})

    with pytest.raises(AllProvidersFailedError):
        await router.complete("analise")  # item voltara para a fila (retry)
    assert cloud.complete_calls == 0


async def test_embed_fallback_hybrid():
    ollama = ScriptedProvider("ollama", fail=True)
    openai = ScriptedProvider("openai", embedding=[0.2] * 768)
    router = make_router(LLMProfile.HYBRID, {"ollama": ollama, "openai": openai})
    vector = await router.embed("teste")
    assert len(vector) == 768
    assert openai.embed_calls == 1


def test_structured_output_validates():
    enrichment = parse_structured(VALID_JSON, EventEnrichment)
    assert enrichment.category == "naval"


def test_structured_output_repairs_fenced_json():
    fenced = "```json\n" + VALID_JSON + "\n```"
    enrichment = parse_structured(fenced, EventEnrichment)
    assert enrichment.severity == "high"


def test_cost_read_from_models_yaml():
    router = make_router(LLMProfile.LOCAL_ONLY, {})
    assert router._cost_usd("llama3.1:8b", 1000, 1000) == 0.0
    paid = router._cost_usd("claude-haiku-4-5-20251001", 1_000_000, 0)
    assert paid == pytest.approx(1.0)
