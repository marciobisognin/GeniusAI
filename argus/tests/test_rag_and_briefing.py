"""RAG anti-alucinacao (DoD 6.2) e briefing diario (DoD 6.3) com fakes."""
import datetime as dt
import types

import pytest

from backend.app.analysis.rag import NO_DATA_ANSWER, RAGService
from backend.app.core.config import LLMProfile
from backend.app.llm.router import LLMRouter
from backend.app.reports import briefing_generator
from tests.conftest import ScriptedProvider


def make_router(response="resposta [fonte: https://example.org/1]"):
    return LLMRouter(providers={"ollama": ScriptedProvider("ollama", response=response)},
                     profile=LLMProfile.LOCAL_ONLY)


class FakeEvent:
    def __init__(self, id_, title, url):
        self.id = id_
        self.title = title
        self.summary = "resumo"
        self.severity = "high"
        self.category = "naval"
        self.event_time = dt.datetime(2026, 7, 22, tzinfo=dt.timezone.utc)
        self.source_url = url
        self.source_name = "Reuters"
        self.region = None
        self.country = "Iran"
        self.confidence = 0.8
        self.is_inference = False


class FakeRepo:
    def __init__(self, hits):
        self.hits = hits
        self.session = None

    async def search_similar_events(self, *args, **kwargs):
        return self.hits


async def test_rag_answers_only_from_retrieved_events():
    repo = FakeRepo([(FakeEvent(1, "Naval event", "https://example.org/1"), 0.1)])
    service = RAGService(repo, router=make_router())
    result = await service.query_rag("Quais eventos navais ocorreram recentemente?")
    assert "example.org/1" in " ".join(result["sources"])
    assert result["events"] == [1]


async def test_rag_no_coverage_returns_no_data():
    service = RAGService(FakeRepo([]), router=make_router())
    result = await service.query_rag("pergunta sem base alguma")
    assert result["answer"] == NO_DATA_ANSWER
    assert result["sources"] == []


async def test_briefing_generates_markdown(tmp_path, monkeypatch):
    monkeypatch.setattr(briefing_generator, "REPORTS_DIR", tmp_path)

    events = [FakeEvent(1, "Evento naval", "https://example.org/1")]

    class FakeResult:
        def scalars(self):
            return types.SimpleNamespace(all=lambda: events)

    class FakeSession:
        async def execute(self, stmt):
            return FakeResult()

        async def close(self):
            pass

    router = make_router(
        "## Sumario executivo\nquadro.\n\n## Fatos\n- fato (confianca: 0.80)\n\n"
        "## Inferencias\n- Avaliamos que... (confianca: 0.60)\n\n## Fontes\n- https://example.org/1"
    )
    path = await briefing_generator.generate_daily_briefing(router=router, session=FakeSession())
    content = path.read_text(encoding="utf-8")
    assert path.name.startswith("briefing_")
    for section in ("Sumario executivo", "Fatos", "Inferencias", "Fontes"):
        assert section in content
    assert "https://example.org/1" in content


async def test_briefing_empty_day_skips_llm(tmp_path, monkeypatch):
    monkeypatch.setattr(briefing_generator, "REPORTS_DIR", tmp_path)

    class FakeResult:
        def scalars(self):
            return types.SimpleNamespace(all=lambda: [])

    class FakeSession:
        async def execute(self, stmt):
            return FakeResult()

        async def close(self):
            pass

    provider = ScriptedProvider("ollama")
    router = LLMRouter(providers={"ollama": provider}, profile=LLMProfile.LOCAL_ONLY)
    path = await briefing_generator.generate_daily_briefing(router=router, session=FakeSession())
    assert provider.complete_calls == 0  # LOCAL_ONLY respeitado e sem custo
    assert "Sem eventos" in path.read_text(encoding="utf-8")
