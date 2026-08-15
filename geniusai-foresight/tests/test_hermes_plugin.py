"""Testes do plug-in do Hermes (`hermes_plugin/`).

O foco é o **contrato com o Hermes**, não a matemática do kernel (essa já é
coberta por `test_simulation_cli.py` e companhia): todo handler devolve string
JSON, nenhum handler levanta exceção, os nomes registrados batem com o
manifesto, e o gate científico continua bloqueando publicação.
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

from foresight import cli  # noqa: E402
import hermes_plugin  # noqa: E402
from hermes_plugin import schemas, tools  # noqa: E402

EXAMPLE = ROOT / "examples/soy-trade-shock.json"


class FakeContext:
    """Dublê do `PluginContext` — registra o que o plug-in pediu para registrar."""

    def __init__(self) -> None:
        self.tools: dict[str, dict[str, object]] = {}
        self.skills: dict[str, Path] = {}

    def register_tool(self, *, name, toolset, schema, handler, **kwargs):
        self.tools[name] = {"toolset": toolset, "schema": schema, "handler": handler}

    def register_skill(self, name, path):
        self.skills[name] = path


class ContextWithoutSkills(FakeContext):
    """Build hipotética do Hermes que não expõe `register_skill`."""

    register_skill = None


def call(handler, **args) -> dict:
    """Chama um handler como o Hermes chamaria e devolve o JSON decodificado."""
    raw = handler(args, task_id="t-1", unknown_future_kwarg=True)
    assert isinstance(raw, str), f"handler devolveu {type(raw)!r}, não string"
    return json.loads(raw)


class RegistrationTest(unittest.TestCase):
    def test_register_wires_every_tool(self):
        ctx = FakeContext()
        hermes_plugin.register(ctx)
        self.assertEqual(len(ctx.tools), 6)
        for entry in ctx.tools.values():
            self.assertEqual(entry["toolset"], "foresight")
            self.assertTrue(callable(entry["handler"]))

    def test_manifest_matches_registered_tools(self):
        """`plugin.yaml:provides_tools` não pode se descolar do código."""
        manifest = (ROOT / "hermes_plugin/plugin.yaml").read_text(encoding="utf-8")
        declared = [
            line.split("- ", 1)[1].strip()
            for line in manifest.splitlines()
            if line.startswith("  - foresight_")
        ]
        self.assertEqual(sorted(declared), sorted(name for name, _, _ in hermes_plugin.TOOLS))

    def test_schema_name_matches_tool_name(self):
        for name, schema, _handler in hermes_plugin.TOOLS:
            self.assertEqual(schema["name"], name)
            self.assertIn("description", schema)
            self.assertEqual(schema["parameters"]["type"], "object")

    def test_skill_is_registered_and_present_on_disk(self):
        ctx = FakeContext()
        hermes_plugin.register(ctx)
        self.assertIn("foresight-cycle", ctx.skills)
        self.assertTrue(hermes_plugin.SKILL_PATH.is_file())

    def test_register_survives_context_without_skill_support(self):
        ctx = ContextWithoutSkills()
        hermes_plugin.register(ctx)  # não pode levantar
        self.assertEqual(len(ctx.tools), 6)

    def test_game_fixture_enum_matches_kernel(self):
        """A enum exposta ao modelo tem de refletir as fixtures reais."""
        self.assertEqual(sorted(schemas.GAME_FIXTURES), sorted(cli.FIXTURES))


class ContractTest(unittest.TestCase):
    """Nenhum handler levanta exceção, em nenhuma entrada."""

    def test_missing_arguments_return_error_envelope(self):
        for name, _schema, handler in hermes_plugin.TOOLS:
            with self.subTest(tool=name):
                payload = call(handler)
                self.assertEqual(payload["status"], "error")
                self.assertTrue(payload["error"])

    def test_hostile_arguments_return_error_envelope(self):
        cases = (
            {"study": "não é um objeto"},
            {"study_path": ""},
            {"study": {}, "study_path": str(EXAMPLE)},
            {"study_path": "/caminho/que/nao/existe.json"},
            {"study": {"brief": {"name": "sem o resto"}}},
        )
        for args in cases:
            with self.subTest(args=args):
                payload = call(tools.validate, **args)
                self.assertEqual(payload["status"], "error")

    def test_handler_accepts_no_args_at_all(self):
        """O Hermes pode chamar sem `args`; nem por isso pode explodir."""
        raw = tools.validate()
        self.assertEqual(json.loads(raw)["status"], "error")

    def test_unknown_fixture_is_an_error_not_a_crash(self):
        payload = call(tools.game, fixture="jogo-inexistente")
        self.assertEqual(payload["status"], "error")


class ValidateAndProfileTest(unittest.TestCase):
    def test_validate_from_path(self):
        payload = call(tools.validate, study_path=str(EXAMPLE))
        self.assertEqual(payload["status"], "valid")
        self.assertEqual(payload["actors"], 5)
        self.assertEqual(len(payload["snapshot_sha256"]), 64)

    def test_validate_inline_matches_validate_from_path(self):
        """Estudo inline passa pelas mesmas guardas e dá o mesmo resultado."""
        study = json.loads(EXAMPLE.read_text(encoding="utf-8"))
        inline = call(tools.validate, study=study)
        from_path = call(tools.validate, study_path=str(EXAMPLE))
        self.assertEqual(inline, from_path)

    def test_inline_study_leaves_no_temporary_file_behind(self):
        before = set(Path(tempfile.gettempdir()).glob("foresight-study-*.json"))
        call(tools.validate, study=json.loads(EXAMPLE.read_text(encoding="utf-8")))
        after = set(Path(tempfile.gettempdir()).glob("foresight-study-*.json"))
        self.assertEqual(before, after)

    def test_profile_lists_cells(self):
        payload = call(tools.profile, study_path=str(EXAMPLE))
        self.assertEqual(payload["status"], "profiled")
        self.assertEqual(len(payload["cells"]), 5)
        for cell in payload["cells"]:
            self.assertTrue(cell["coordinator"])
            self.assertTrue(cell["specialists"])


class GameTest(unittest.TestCase):
    def test_every_declared_fixture_is_analysable(self):
        for fixture in schemas.GAME_FIXTURES:
            with self.subTest(fixture=fixture):
                payload = call(tools.game, fixture=fixture)
                self.assertEqual(payload["status"], "analyzed")
                self.assertEqual(payload["fixture"], fixture)
                self.assertIn("pure_nash", payload)
                self.assertTrue(payload["qre"]["converged"])

    def test_prisoners_dilemma_has_the_known_equilibrium(self):
        payload = call(tools.game, fixture="prisoners-dilemma")
        self.assertEqual(payload["pure_nash"], [[1, 1]])


class RunTest(unittest.TestCase):
    """Execução de verdade: 600 runs sobre o exemplo canônico."""

    @classmethod
    def setUpClass(cls):
        cls._tmp = tempfile.TemporaryDirectory()
        cls.output = Path(cls._tmp.name) / "run"
        cls.payload = call(tools.run, study_path=str(EXAMPLE), output_dir=str(cls.output))

    @classmethod
    def tearDownClass(cls):
        cls._tmp.cleanup()

    def test_completes_with_research_only_label(self):
        self.assertEqual(self.payload["status"], "completed_research_only")
        self.assertEqual(self.payload["gate"]["status"], tools.GATE_GO)
        self.assertEqual(self.payload["runs"], 600)

    def test_writes_the_three_artifacts(self):
        for name in ("result.json", "report.md", "report.html"):
            with self.subTest(artifact=name):
                self.assertTrue((self.output / name).is_file())

    def test_warnings_are_passed_through(self):
        """Os limites do resultado não podem sumir no caminho até o agente."""
        self.assertTrue(self.payload["warnings"])

    def test_payload_matches_the_cli_contract(self):
        """O plug-in não pode divergir do que a CLI do kernel devolve."""
        with tempfile.TemporaryDirectory() as other:
            from_cli = cli.run_study(EXAMPLE, Path(other) / "cli")
        for field in ("status", "study", "actors", "specialists", "runs", "gate", "model_signature_sha256", "warnings"):
            with self.subTest(field=field):
                self.assertEqual(self.payload[field], from_cli[field])

    def test_refuses_to_overwrite_without_force(self):
        payload = call(tools.run, study_path=str(EXAMPLE), output_dir=str(self.output))
        self.assertEqual(payload["status"], "error")

    def test_replay_of_the_written_result_matches(self):
        payload = call(
            tools.replay,
            study_path=str(EXAMPLE),
            expected_path=str(self.output / "result.json"),
        )
        self.assertEqual(payload["status"], "match")
        self.assertEqual(payload["expected_sha256"], payload["actual_sha256"])


class GateTest(unittest.TestCase):
    """O gate reprovado precisa ser legível por máquina, e não escrever nada."""

    class _Brief:
        name = "estudo reprovado"

    def _kernel_with_gate(self, status: str, written: list):
        test = self

        class FakeKernel:
            @staticmethod
            def execute_study(path):
                return (test._Brief(), None, [], [], None, {"status": status, "reason": "fixture"})

            @staticmethod
            def write_reports(*args, **kwargs):
                written.append(args)
                return {}

        return FakeKernel()

    def test_blocked_gate_reports_status_and_writes_nothing(self):
        written: list = []
        payload = tools._execute(
            self._kernel_with_gate("no_go", written),
            Path("/estudo.json"),
            Path("/saida"),
            force=False,
        )
        self.assertEqual(payload["status"], "blocked_by_gate")
        self.assertEqual(payload["gate"]["status"], "no_go")
        self.assertTrue(payload["hint"])
        self.assertEqual(written, [], "nada pode ser escrito com o gate reprovado")


if __name__ == "__main__":
    unittest.main()
