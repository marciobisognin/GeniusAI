"""Testes do plug-in de extração normativa.

Cobrem o contrato com o Hermes — não a extração de PDF em si, que depende de
`pdfplumber`/`pypdf` e de um documento real. O que precisa ser garantido aqui é
que o plug-in **carrega e responde** mesmo sem essas dependências, e que
nenhuma entrada faz um handler levantar exceção.

Rodar: python -m unittest discover -s hermes_plugin -p 'test_*.py'
"""
from __future__ import annotations

import json
from pathlib import Path
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import hermes_plugin  # noqa: E402
from hermes_plugin import tools  # noqa: E402


class FakeContext:
    def __init__(self) -> None:
        self.tools: dict[str, object] = {}
        self.skills: dict[str, Path] = {}

    def register_tool(self, *, name, toolset, schema, handler, **kwargs):
        self.tools[name] = {"toolset": toolset, "schema": schema, "handler": handler}

    def register_skill(self, name, path):
        self.skills[name] = path


class ContextWithoutSkills(FakeContext):
    register_skill = None


def call(handler, **args) -> dict:
    raw = handler(args, task_id="t-1", futuro=True)
    assert isinstance(raw, str), f"handler devolveu {type(raw)!r}, não string"
    return json.loads(raw)


class RegistrationTest(unittest.TestCase):
    def test_registers_both_tools(self):
        ctx = FakeContext()
        hermes_plugin.register(ctx)
        self.assertEqual(sorted(ctx.tools), ["org_extract_competencias", "org_extract_pdf"])
        for entry in ctx.tools.values():
            self.assertEqual(entry["toolset"], "organograma")

    def test_manifest_matches_registered_tools(self):
        manifest = (Path(__file__).parent / "plugin.yaml").read_text(encoding="utf-8")
        declared = [
            line.split("- ", 1)[1].strip()
            for line in manifest.splitlines()
            if line.startswith("  - org_")
        ]
        self.assertEqual(sorted(declared), sorted(name for name, _, _ in hermes_plugin.TOOLS))

    def test_declares_its_heavy_dependencies(self):
        """Sem isso, o `hermes plugins enable` não sabe o que instalar."""
        manifest = (Path(__file__).parent / "plugin.yaml").read_text(encoding="utf-8")
        for dependency in ("pdfplumber", "pypdf", "PyYAML"):
            self.assertIn(dependency, manifest)

    def test_registers_the_skill(self):
        ctx = FakeContext()
        hermes_plugin.register(ctx)
        self.assertIn("organograma-normativo", ctx.skills)
        self.assertTrue(hermes_plugin.SKILL_PATH.is_file())

    def test_survives_context_without_skill_support(self):
        ctx = ContextWithoutSkills()
        hermes_plugin.register(ctx)
        self.assertEqual(len(ctx.tools), 2)

    def test_schema_name_matches_tool_name(self):
        for name, schema, _handler in hermes_plugin.TOOLS:
            self.assertEqual(schema["name"], name)
            self.assertIn("pdf_path", schema["parameters"]["properties"])
            self.assertEqual(schema["parameters"]["required"], ["pdf_path"])


class ContractTest(unittest.TestCase):
    """O plug-in carrega e responde mesmo sem pdfplumber instalado."""

    def test_missing_argument_is_an_error_envelope(self):
        for _name, _schema, handler in hermes_plugin.TOOLS:
            payload = call(handler)
            self.assertEqual(payload["status"], "error")
            self.assertIn("pdf_path", payload["error"])

    def test_hostile_arguments_never_raise(self):
        cases = (
            {"pdf_path": ""},
            {"pdf_path": 42},
            {"pdf_path": "/caminho/inexistente.pdf"},
            {"pdf_path": "/etc/hostname"},
        )
        for _name, _schema, handler in hermes_plugin.TOOLS:
            for args in cases:
                with self.subTest(args=args):
                    self.assertEqual(call(handler, **args)["status"], "error")

    def test_rejects_non_pdf_extension(self):
        with tempfile.NamedTemporaryFile(suffix=".txt") as handle:
            payload = call(tools.extract_pdf, pdf_path=handle.name)
        self.assertEqual(payload["status"], "error")
        self.assertIn(".pdf", payload["error"])

    def test_rejects_out_of_range_page(self):
        with tempfile.NamedTemporaryFile(suffix=".pdf") as handle:
            for bad in (-1, 10_001, "18", True):
                with self.subTest(page=bad):
                    payload = call(tools.extract_pdf, pdf_path=handle.name, last_page=bad)
                    self.assertEqual(payload["status"], "error")

    def test_handler_accepts_no_args_at_all(self):
        self.assertEqual(json.loads(tools.extract_pdf())["status"], "error")

    def test_extractors_are_where_the_plugin_expects(self):
        for module in ("extrair_organograma", "extrair_competencias"):
            self.assertTrue((tools.TOOLS_DIR / f"{module}.py").is_file(), module)


if __name__ == "__main__":
    unittest.main()
