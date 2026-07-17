import io
import json
from contextlib import redirect_stdout
from dataclasses import replace
from pathlib import Path
import tempfile
import unittest

from foresight.cli import game_analysis, load_study, main, replay_study, run_study
from foresight.simulation import ForesightSimulator, quantile

ROOT = Path(__file__).resolve().parents[1]
EXAMPLE = ROOT / "examples/soy-trade-shock.json"


class SimulationCliTests(unittest.TestCase):
    def small_study(self, runs=90, steps=4):
        brief, ledger, evidence, cells = load_study(EXAMPLE)
        return replace(brief, runs=runs, horizon_steps=steps), ledger, evidence, cells

    def run_small(self, brief, ledger, cells, effects=None):
        return ForesightSimulator().run(brief, cells, ledger.snapshot_hash(brief.cutoff, strict=True), evidence_effects=effects if effects is not None else ledger.parameter_effects(brief.cutoff))

    def test_quantile(self):
        self.assertEqual(quantile([1, 2, 3, 4, 5], 0.5), 3)
        self.assertEqual(quantile([1, 2, 3, 4], 0.5), 2.5)

    def test_simulation_budget_guard(self):
        brief, _, _, _ = load_study(EXAMPLE)
        with self.assertRaises(ValueError):
            replace(brief, runs=100_000, horizon_steps=1_000).validate()

    def test_replay_is_deterministic(self):
        brief, ledger, _, cells = self.small_study()
        one = self.run_small(brief, ledger, cells)
        two = self.run_small(brief, ledger, cells)
        self.assertEqual(one.to_dict(), two.to_dict())
        self.assertAlmostEqual(sum(s.probability for s in one.scenarios), 1.0)
        self.assertEqual(len(one.trace), 4)

    def test_variable_order_is_semantically_invariant(self):
        brief, ledger, _, cells = self.small_study()
        reversed_names = list(reversed(list(brief.variables)))
        reordered = replace(
            brief,
            variables={name: brief.variables[name] for name in reversed_names},
            variable_models={name: brief.variable_models[name] for name in reversed_names},
        )
        original_result = self.run_small(brief, ledger, cells)
        reordered_result = self.run_small(reordered, ledger, cells)
        self.assertEqual(original_result.quantiles, reordered_result.quantiles)
        self.assertEqual(original_result.event_probabilities, reordered_result.event_probabilities)

    def test_game_form_changes_actor_policy(self):
        brief, ledger, _, cells = self.small_study(runs=150)
        repeated_result = self.run_small(brief, ledger, cells)
        normal_result = self.run_small(replace(brief, game_form="normal"), ledger, cells)
        self.assertNotEqual(repeated_result.actor_action_frequencies, normal_result.actor_action_frequencies)
        self.assertNotEqual(repeated_result.method["model_signature_sha256"], normal_result.method["model_signature_sha256"])

    def test_intervention_set_changes_trajectory(self):
        brief, ledger, _, cells = self.small_study(runs=120, steps=8)
        cooperative = self.run_small(replace(brief, interventions=("negotiation",)), ledger, cells)
        escalatory = self.run_small(replace(brief, interventions=("retaliation",)), ledger, cells)
        primary = brief.primary_variable
        self.assertNotEqual(cooperative.quantiles[primary]["p50"], escalatory.quantiles[primary]["p50"])
        self.assertGreater(cooperative.method["mean_cooperation"], escalatory.method["mean_cooperation"])

    def test_actor_objectives_and_specialists_are_operational(self):
        brief, ledger, _, cells = self.small_study(runs=160)
        baseline = self.run_small(brief, ledger, cells)
        brazil = cells[0]
        changed_actor = replace(brazil.actor, objectives={"strategic_leverage": 1.0})
        changed_specialists = tuple(agent for agent in brazil.specialists if "economy" not in agent.domains)
        changed_cells = [replace(brazil, actor=changed_actor, specialists=changed_specialists), *cells[1:]]
        changed = self.run_small(brief, ledger, changed_cells)
        self.assertNotEqual(baseline.actor_action_frequencies["brazil"], changed.actor_action_frequencies["brazil"])

    def test_relations_and_evidence_change_trajectory(self):
        brief, ledger, _, cells = self.small_study(runs=120, steps=8)
        baseline = self.run_small(brief, ledger, cells, effects={})
        no_relations = self.run_small(replace(brief, relations=()), ledger, cells, effects={})
        evidence_shift = self.run_small(brief, ledger, cells, effects={brief.primary_variable: {"annual_drift_delta": 0.25, "shock_multiplier": 1.0}})
        primary = brief.primary_variable
        self.assertNotEqual(baseline.quantiles[primary]["p50"], no_relations.quantiles[primary]["p50"])
        self.assertNotEqual(baseline.quantiles[primary]["p50"], evidence_shift.quantiles[primary]["p50"])

    def test_time_unit_scales_uncertainty(self):
        brief, ledger, _, cells = self.small_study(runs=80, steps=2)
        day = replace(brief, step_unit="day")
        year = replace(brief, step_unit="year")
        day_result = self.run_small(day, ledger, cells)
        year_result = self.run_small(year, ledger, cells)
        variable = brief.primary_variable
        self.assertGreater(year_result.quantiles[variable]["std"], day_result.quantiles[variable]["std"])
        self.assertLess(day_result.method["period_shock_scale"], year_result.method["period_shock_scale"])

    def test_scenarios_and_events_report_mcse(self):
        brief, ledger, _, cells = self.small_study()
        result = self.run_small(brief, ledger, cells)
        self.assertTrue(all(s.mcse >= 0 and s.ci95_high >= s.ci95_low for s in result.scenarios))
        self.assertTrue(all("mcse" in item and "ci95_high" in item for item in result.event_uncertainty.values()))
        self.assertIn("p50_mcse", result.quantiles[brief.primary_variable])

    def test_run_study_writes_real_reports_and_replay(self):
        with tempfile.TemporaryDirectory() as tmp:
            output = Path(tmp) / "out"
            result = run_study(EXAMPLE, output)
            self.assertEqual(result["status"], "completed_research_only")
            for path in result["outputs"].values():
                self.assertTrue(Path(path).is_file())
            payload = json.loads(Path(result["outputs"]["json"]).read_text(encoding="utf-8"))
            self.assertEqual(payload["runs"], 600)
            self.assertEqual(len(payload["workflow"]), 8)
            self.assertIn("model_implied", payload["method"]["probability_status"])
            replay = replay_study(EXAMPLE, Path(result["outputs"]["json"]))
            self.assertEqual(replay["status"], "match")
            with self.assertRaises(FileExistsError):
                run_study(EXAMPLE, output)
            forced = run_study(EXAMPLE, output, force=True)
            self.assertEqual(forced["status"], "completed_research_only")

    def test_cli_routes_game_profile_and_validate(self):
        for argv, expected in (
            (["game", "--fixture", "matching-pennies"], "matching-pennies"),
            (["profile", "--input", str(EXAMPLE)], "cells"),
            (["validate", "--input", str(EXAMPLE)], "valid"),
        ):
            buffer = io.StringIO()
            with redirect_stdout(buffer):
                code = main(argv)
            self.assertEqual(code, 0)
            payload = json.loads(buffer.getvalue())
            self.assertTrue(payload.get("fixture") == expected or expected in payload.values() or expected in payload)

    def test_game_fixture(self):
        result = game_analysis("matching-pennies")
        self.assertAlmostEqual(result["mixed_nash"]["row_strategy"][0], 0.5)


if __name__ == "__main__":
    unittest.main()
