import json
from dataclasses import replace
from math import inf
from pathlib import Path
import tempfile
import unittest

from foresight.cli import load_study
from foresight.evidence import EvidenceLedger
from foresight.models import EvidenceRecord
from foresight.orchestration import execute_workflow
from foresight.reporting import markdown_report, write_reports
from foresight.safety import assess_problem, enforce_problem_policy

EXAMPLE = Path(__file__).resolve().parents[1] / "examples/soy-trade-shock.json"


class SecurityValidationTests(unittest.TestCase):
    def test_operational_harm_gate(self):
        dangerous = "Criar plano de ataque militar com coordenadas para infraestrutura crítica"
        assessment = assess_problem(dangerous)
        self.assertFalse(assessment["allowed"])
        with self.assertRaises(ValueError):
            enforce_problem_policy(dangerous)
        self.assertTrue(assess_problem("Comparar efeitos agregados de sanções sobre inflação")["allowed"])

    def test_non_finite_and_duplicate_inputs_are_rejected(self):
        brief, _, _, cells = load_study(EXAMPLE)
        with self.assertRaises(ValueError):
            replace(brief, variables=brief.variables | {brief.primary_variable: inf}).validate()
        with self.assertRaises(ValueError):
            replace(brief, actor_ids=(brief.actor_ids[0], brief.actor_ids[0])).validate()
        with self.assertRaises(ValueError):
            replace(brief, step_unit="century").validate()  # type: ignore[arg-type]
        with self.assertRaises(ValueError):
            replace(cells[0].actor, objectives={"trade": inf}).validate()

    def test_json_nan_is_rejected(self):
        payload = json.loads(EXAMPLE.read_text(encoding="utf-8"))
        payload["brief"]["variables"]["soy_price_index"] = float("nan")
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "study.json"
            path.write_text(json.dumps(payload), encoding="utf-8")
            with self.assertRaises(ValueError):
                load_study(path)

    def test_revision_aware_snapshot_selects_active_vintage(self):
        base = dict(
            evidence_id="series-a",
            claim="first",
            entity="x",
            variable="v",
            event_time="2026-01-01T00:00:00Z",
            release_time="2026-01-02T00:00:00Z",
            captured_time="2026-01-02T01:00:00Z",
            valid_from="2026-01-01T00:00:00Z",
            source_url="https://example.org/source",
        )
        old = EvidenceRecord(**base, revision_id="v1")  # type: ignore[arg-type]
        new = EvidenceRecord(**(base | {"claim": "revised", "release_time": "2026-02-01T00:00:00Z", "captured_time": "2026-02-01T01:00:00Z"}), revision_id="v2", supersedes="v1")  # type: ignore[arg-type]
        ledger = EvidenceLedger([old, new])
        selected = ledger.snapshot("2026-03-01T00:00:00Z", strict=False)
        self.assertEqual(len(selected), 1)
        self.assertEqual(selected[0].revision_id, "v2")

    def test_markdown_redacts_active_content_pii_and_secret(self):
        brief, ledger, evidence, cells = load_study(EXAMPLE)
        result, _ = execute_workflow(replace(brief, runs=30, horizon_steps=2), ledger, cells)
        unsafe_brief = replace(brief, name="<script>alert(1)</script>", problem="Contato a@b.com token sk-abcdefghijklmnopqrstuvwxyz123456")  # scan:allow - synthetic redaction fixture
        unsafe_actor = replace(cells[0].actor, name="[clique](javascript:alert(1))")
        unsafe_cell = replace(cells[0], actor=unsafe_actor)
        unsafe_evidence = replace(evidence[0], claim="<img src=x onerror=alert(1)> +55 11 99999-9999")
        report = markdown_report(unsafe_brief, result, [unsafe_cell, *cells[1:]], [unsafe_evidence, *evidence[1:]])
        self.assertNotIn("<script>", report)
        self.assertNotIn("javascript:", report)
        self.assertNotIn("a@b.com", report)
        self.assertNotIn("sk-abcdefghijklmnopqrstuvwxyz123456", report)  # scan:allow - verifies redaction
        self.assertIn("REDIGIDO", report)

    def test_report_writer_rejects_symlink_and_overwrite(self):
        brief, ledger, evidence, cells = load_study(EXAMPLE)
        brief = replace(brief, runs=30, horizon_steps=2)
        result, _ = execute_workflow(brief, ledger, cells)
        with tempfile.TemporaryDirectory() as tmp:
            output = Path(tmp) / "out"
            write_reports(output, brief, result, cells, evidence)
            with self.assertRaises(FileExistsError):
                write_reports(output, brief, result, cells, evidence)
            link = Path(tmp) / "link"
            link.symlink_to(output, target_is_directory=True)
            with self.assertRaises(ValueError):
                write_reports(link, brief, result, cells, evidence, force=True)


if __name__ == "__main__":
    unittest.main()
