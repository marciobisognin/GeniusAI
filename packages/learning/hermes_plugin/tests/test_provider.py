"""Testes do memory provider — contrato do Hermes e a regra da procedência."""
from __future__ import annotations

import json
from pathlib import Path
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import hermes_plugin  # noqa: E402
from hermes_plugin.provider import GeniusMemoryProvider  # noqa: E402
from hermes_plugin.store import SOURCE_TYPES, MemoryStore  # noqa: E402


class FakeContext:
    def __init__(self, config: dict | None = None) -> None:
        self.tools: dict[str, object] = {}
        self.provider = None
        self._config = config or {}

    def register_tool(self, *, name, toolset, schema, handler, **kwargs):
        self.tools[name] = {"toolset": toolset, "schema": schema, "handler": handler}

    def register_memory_provider(self, provider):
        self.provider = provider

    def get_config(self, key, default=None):
        return self._config.get(key, default)


class ContextWithoutMemorySupport(FakeContext):
    register_memory_provider = None


class TempProviderTest(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.provider = GeniusMemoryProvider(Path(self._tmp.name) / "memory.sqlite3")
        self.provider.initialize("sessao-1")

    def tearDown(self):
        self.provider.close()
        self._tmp.cleanup()

    def call(self, handler, **args) -> dict:
        raw = handler(args, task_id="t-1", futuro=True)
        self.assertIsInstance(raw, str)
        return json.loads(raw)


class RegistrationTest(unittest.TestCase):
    def test_registers_provider_and_tools(self):
        with tempfile.TemporaryDirectory() as directory:
            ctx = FakeContext({"db_path": f"{directory}/m.sqlite3"})
            hermes_plugin.register(ctx)
            self.assertEqual(sorted(ctx.tools), ["memory_index", "memory_search"])
            self.assertEqual(ctx.provider.name, "genius-memory")
            ctx.provider.close()

    def test_survives_context_without_memory_support(self):
        with tempfile.TemporaryDirectory() as directory:
            ctx = ContextWithoutMemorySupport({"db_path": f"{directory}/m.sqlite3"})
            hermes_plugin.register(ctx)  # não pode levantar
            self.assertEqual(len(ctx.tools), 2)

    def test_manifest_matches_registered_tools(self):
        manifest = (Path(hermes_plugin.__file__).parent / "plugin.yaml").read_text(encoding="utf-8")
        declared = [
            line.split("- ", 1)[1].strip()
            for line in manifest.splitlines()
            if line.startswith("  - memory_")
        ]
        with tempfile.TemporaryDirectory() as directory:
            provider = GeniusMemoryProvider(Path(directory) / "m.sqlite3")
            self.assertEqual(sorted(declared), sorted(s["name"] for s in provider.get_tool_schemas()))
            provider.close()

    def test_declares_no_external_dependency(self):
        """O índice é SQLite e o embedding é local — nada para instalar."""
        manifest = (Path(hermes_plugin.__file__).parent / "plugin.yaml").read_text(encoding="utf-8")
        self.assertIn("python_dependencies: []", manifest)


class ContractTest(TempProviderTest):
    def test_provider_implements_the_hermes_contract(self):
        for member in ("name", "is_available", "initialize", "sync_turn", "prefetch", "get_tool_schemas"):
            self.assertTrue(hasattr(self.provider, member), member)
        self.assertTrue(self.provider.is_available())
        self.assertIsInstance(self.provider.get_tool_schemas(), list)

    def test_handlers_never_raise(self):
        hostile = (
            {},
            {"query": ""},
            {"query": "ok", "k": 0},
            {"query": "ok", "k": "cinco"},
            {"query": "ok", "source_types": ["inexistente"]},
        )
        for args in hostile:
            with self.subTest(args=args):
                self.assertEqual(self.call(self.provider.handle_search, **args)["status"], "error")

        for args in ({}, {"text": ""}, {"text": "x", "source_type": "approval"}):
            with self.subTest(args=args):
                self.assertEqual(self.call(self.provider.handle_index, **args)["status"], "error")

    def test_memory_without_provenance_is_refused(self):
        payload = self.call(self.provider.handle_index, text="algo", source_type="approval", source_id="")
        self.assertEqual(payload["status"], "error")
        self.assertIn("procedência", payload["error"])

    def test_unknown_source_type_is_refused(self):
        payload = self.call(
            self.provider.handle_index, text="algo", source_type="palpite", source_id="x-1"
        )
        self.assertEqual(payload["status"], "error")


class RetrievalTest(TempProviderTest):
    def index(self, text, source_type, source_id):
        return self.call(
            self.provider.handle_index, text=text, source_type=source_type, source_id=source_id
        )

    def test_indexes_and_finds_by_meaning(self):
        self.index("Parecer de fiscalização do contrato 12/2026", "approval", "apr-7")
        self.index("Receita de bolo de cenoura", "conversation", "sess-9")
        payload = self.call(self.provider.handle_search, query="fiscalizar contrato")
        self.assertEqual(payload["status"], "ok")
        self.assertEqual(payload["results"][0]["sourceId"], "apr-7")

    def test_every_result_carries_provenance(self):
        self.index("Instrução do processo de compra", "run", "run-3")
        for result in self.call(self.provider.handle_search, query="processo de compra")["results"]:
            self.assertIn(result["sourceType"], SOURCE_TYPES)
            self.assertTrue(result["sourceId"])
            self.assertTrue(result["createdAt"])

    def test_source_type_filter(self):
        self.index("contrato administrativo", "approval", "apr-1")
        self.index("contrato administrativo", "conversation", "sess-1")
        payload = self.call(self.provider.handle_search, query="contrato", source_types=["approval"])
        self.assertEqual({item["sourceType"] for item in payload["results"]}, {"approval"})

    def test_reindexing_the_same_id_updates_instead_of_duplicating(self):
        self.call(
            self.provider.handle_index,
            text="versão 1",
            source_type="run",
            source_id="run-1",
            chunk_id="fixo",
        )
        self.call(
            self.provider.handle_index,
            text="versão 2",
            source_type="run",
            source_id="run-1",
            chunk_id="fixo",
        )
        self.assertEqual(self.provider.store.count("run"), 1)

    def test_sync_turn_stores_conversation_with_weaker_provenance(self):
        self.provider.sync_turn("como fiscalizo um contrato?", "siga o art. 117", session_id="s-1")
        results = self.call(self.provider.handle_search, query="fiscalizar contrato")["results"]
        self.assertEqual(results[0]["sourceType"], "conversation")

    def test_empty_turn_is_not_stored(self):
        self.provider.sync_turn("", "", session_id="s-1")
        self.assertEqual(self.provider.store.count("conversation"), 0)

    def test_prefetch_prefers_approved_over_conversation(self):
        self.provider.sync_turn("contrato administrativo", "resposta qualquer", session_id="s-1")
        self.index("contrato administrativo fiscalizado e aprovado", "approval", "apr-9")
        context = self.provider.prefetch("contrato administrativo")
        linhas = [linha for linha in context.splitlines() if linha.startswith("- [")]
        self.assertTrue(linhas[0].startswith("- [aprovação apr-9]"), linhas)

    def test_prefetch_is_empty_when_nothing_matches(self):
        self.assertEqual(self.provider.prefetch("assunto inexistente"), "")

    def test_prefetch_explains_the_provenance(self):
        self.index("execução aprovada", "approval", "apr-2")
        self.assertIn("revisão humana", self.provider.prefetch("execução"))


class StoreTest(unittest.TestCase):
    def test_search_is_deterministic_on_ties(self):
        with tempfile.TemporaryDirectory() as directory:
            store = MemoryStore(Path(directory) / "m.sqlite3")
            for index in range(5):
                store.index_chunk(
                    chunk_id=f"c{index}", text="mesmo texto", source_type="run", source_id=f"r{index}"
                )
            first = [hit.id for hit in store.search("mesmo texto", k=5)]
            second = [hit.id for hit in store.search("mesmo texto", k=5)]
            self.assertEqual(first, second)
            self.assertEqual(first, sorted(first))
            store.close()

    def test_survives_reopen(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "m.sqlite3"
            store = MemoryStore(path)
            store.index_chunk(chunk_id="c1", text="persistente", source_type="run", source_id="r1")
            store.close()

            reopened = MemoryStore(path)
            self.assertEqual(reopened.count(), 1)
            self.assertEqual(reopened.stats(), {"run": 1})
            reopened.close()

    def test_empty_query_returns_nothing(self):
        with tempfile.TemporaryDirectory() as directory:
            store = MemoryStore(Path(directory) / "m.sqlite3")
            store.index_chunk(chunk_id="c1", text="algo", source_type="run", source_id="r1")
            self.assertEqual(store.search(""), [])
            store.close()


if __name__ == "__main__":
    unittest.main()
