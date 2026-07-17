"""Executable orchestration of the declared Foresight workflow."""
from __future__ import annotations

from typing import Any

from .evidence import EvidenceLedger
from .models import ActorCell, SimulationBrief, SimulationResult
from .safety import enforce_problem_policy
from .simulation import ForesightSimulator


def _stage(task: str, agent: str, status: str, evidence: dict[str, Any]) -> dict[str, Any]:
    return {"task": task, "agent": agent, "status": status, "evidence": evidence}


def execute_workflow(brief: SimulationBrief, ledger: EvidenceLedger, cells: list[ActorCell]) -> tuple[SimulationResult, dict[str, Any]]:
    """Run all eight MVP stages and return a report-publication gate."""
    workflow: list[dict[str, Any]] = []
    enforce_problem_policy(brief.problem)
    brief.validate()
    workflow.append(_stage("frame-study", "intake-orchestrator", "passed", {"forecast_contract": brief.forecast_contract, "primary_variable": brief.primary_variable}))

    evidence = ledger.snapshot(brief.cutoff, strict=True)
    if not evidence:
        raise ValueError("nenhuma evidência admissível na data de corte")
    evidence_quality = ledger.quality_summary(brief.cutoff)
    workflow.append(_stage("build-evidence-snapshot", "evidence-auditor", "passed", evidence_quality | {"snapshot_sha256": ledger.snapshot_hash(brief.cutoff, strict=True)}))

    specialist_count = sum(1 + len(cell.specialists) for cell in cells)
    if specialist_count <= len(cells):
        raise ValueError("actor cells sem especialistas operacionais")
    workflow.append(_stage("profile-actors", "country-profiler", "passed", {"actors": len(cells), "operational_agents": specialist_count}))

    workflow.append(_stage("select-game-form", "game-theory-modeler", "passed", {"game_form": brief.game_form, "interventions": list(brief.interventions)}))
    evidence_effects = ledger.parameter_effects(brief.cutoff)
    workflow.append(_stage("build-causal-model", "causal-forecaster", "passed", {"variable_models": sorted(brief.variable_models), "evidence_parameterized_variables": sorted(evidence_effects)}))

    workflow.append(_stage("run-scenarios", "simulation-engineer", "running", {"runs": brief.runs, "horizon_steps": brief.horizon_steps, "step_unit": brief.step_unit}))
    result = ForesightSimulator().run(
        brief,
        cells,
        ledger.snapshot_hash(brief.cutoff, strict=True),
        evidence_effects=evidence_effects,
        workflow=workflow,
    )
    workflow[-1] = _stage("run-scenarios", "simulation-engineer", "passed", {"runs": brief.runs, "trace_steps": len(result.trace), "model_signature": result.method["model_signature_sha256"]})

    stability_ok = float(result.method["max_seed_spread"]) <= 0.15
    qre_ok = bool(result.method["qre_converged"]) and float(result.method["qre_residual"]) <= 1e-8
    uncertainty_ok = all("mcse" in item for item in result.event_uncertainty.values())
    red_team_status = "passed" if stability_ok and qre_ok and uncertainty_ok else "failed"
    workflow.append(_stage("calibrate-and-red-team", "red-team-calibrator", red_team_status, {"stability_ok": stability_ok, "qre_ok": qre_ok, "uncertainty_reported": uncertainty_ok, "empirically_calibrated": False}))
    if red_team_status != "passed":
        gate = {"status": "no_go", "reason": "scientific_quality_gate_failed", "research_only": True}
    else:
        gate = {"status": "go_research_only", "reason": "model-implied probabilities with uncertainty; empirical calibration pending", "research_only": True}
    workflow.append(_stage("publish-brief", "report-narrator", "passed" if gate["status"] == "go_research_only" else "blocked", gate))
    result.workflow = workflow
    return result, gate
