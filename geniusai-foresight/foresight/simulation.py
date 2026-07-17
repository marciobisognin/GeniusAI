"""Semantic, seeded and auditable scenario simulation for the research MVP."""
from __future__ import annotations

from collections.abc import Mapping, Sequence
from hashlib import sha256
import json
from math import exp, sqrt
import random
from statistics import fmean, pstdev
from typing import Any

from .game_theory import qre_logit_2x2
from .models import ActorCell, ScenarioSummary, SimulationBrief, SimulationResult


def quantile(values: Sequence[float], probability: float) -> float:
    if not values or not 0 <= probability <= 1:
        raise ValueError("quantile inválido")
    ordered = sorted(float(v) for v in values)
    position = probability * (len(ordered) - 1)
    lower = int(position)
    upper = min(len(ordered) - 1, lower + 1)
    fraction = position - lower
    return ordered[lower] * (1 - fraction) + ordered[upper] * fraction


def binomial_uncertainty(count: int, total: int) -> dict[str, float]:
    """MCSE and Wilson 95% interval for a Monte Carlo event frequency."""
    if total < 1 or not 0 <= count <= total:
        raise ValueError("contagem binomial inválida")
    probability = count / total
    mcse = sqrt(probability * (1 - probability) / total)
    z = 1.959963984540054
    denominator = 1 + z * z / total
    center = (probability + z * z / (2 * total)) / denominator
    half = z * sqrt(probability * (1 - probability) / total + z * z / (4 * total * total)) / denominator
    return {"probability": probability, "mcse": mcse, "ci95_low": max(0.0, center - half), "ci95_high": min(1.0, center + half)}


def bootstrap_quantile_mcse(values: Sequence[float], probability: float, seed: int, repetitions: int = 120) -> float:
    if len(values) < 2:
        return 0.0
    # A seeded PRNG is required for reproducible scientific bootstrap, not cryptography.
    rng = random.Random(seed)  # nosec B311
    estimates = []
    for _ in range(repetitions):
        sample = [values[rng.randrange(len(values))] for _ in values]
        estimates.append(quantile(sample, probability))
    return pstdev(estimates)


def _softmax(scores: Mapping[str, float], temperature: float) -> dict[str, float]:
    scaled = {key: value / max(temperature, 1e-6) for key, value in scores.items()}
    maximum = max(scaled.values())
    weights = {key: exp(value - maximum) for key, value in scaled.items()}
    total = sum(weights.values())
    return {key: value / total for key, value in weights.items()}


def _game_matrix(game_form: str):
    if "repeated" in game_form:
        return (((4.0, 4.0), (0.0, 3.0)), ((3.0, 0.0), (2.0, 2.0)))  # Stag Hunt
    if game_form == "stackelberg":
        return (((3.0, 3.0), (1.0, 4.0)), ((4.0, 1.0), (0.0, 0.0)))  # Chicken
    if game_form == "coalitional":
        return (((5.0, 5.0), (0.0, 2.0)), ((2.0, 0.0), (1.0, 1.0)))
    return (((3.0, 3.0), (0.0, 4.0)), ((4.0, 0.0), (1.0, 1.0)))  # Prisoner's Dilemma


def _matches_rule(value: float, rule: Mapping[str, Any]) -> bool:
    thresholds = [float(item) for item in rule["thresholds"]]
    operator = rule["operator"]
    if operator == "lt":
        return value < thresholds[0]
    if operator == "lte":
        return value <= thresholds[0]
    if operator == "gt":
        return value > thresholds[0]
    if operator == "gte":
        return value >= thresholds[0]
    return thresholds[0] <= value <= thresholds[1]


class ForesightSimulator:
    """Structured domain-pack engine with operational actor cells.

    Every state transition is keyed by a named variable model. Actor objectives,
    capabilities, constraints, specialist domains, relations, selected
    interventions, game form and provenance-linked evidence all affect policy or
    transition coefficients. No coefficient depends on JSON insertion order.
    """

    unit_year_fraction = {"day": 1.0 / 365.0, "week": 7.0 / 365.0, "month": 1.0 / 12.0, "year": 1.0}

    def _actor_policies(self, brief: SimulationBrief, cells: Sequence[ActorCell]) -> tuple[dict[str, dict[str, float]], float, float, float]:
        game = _game_matrix(brief.game_form)
        qre = qre_logit_2x2(game, 1.2, 1.2, iterations=5000, tolerance=1e-10)
        if not qre["converged"]:
            raise ValueError(f"QRE não convergiu; residual={qre['residual']}")
        game_cooperation = float(qre["row_strategy"][0])
        relation_values = [float(item["strength"]) for item in brief.relations]
        relation_mean = fmean(relation_values) if relation_values else 0.0
        relations_by_actor: dict[str, list[float]] = {actor_id: [] for actor_id in brief.actor_ids}
        for relation in brief.relations:
            strength = float(relation["strength"])
            relations_by_actor[str(relation["source"])].append(strength)
            relations_by_actor[str(relation["target"])].append(strength)

        policies: dict[str, dict[str, float]] = {}
        for cell in sorted(cells, key=lambda item: item.actor.actor_id):
            actor = cell.actor
            objective_total = sum(actor.objectives.values())
            normalized_objectives = {key: value / objective_total for key, value in actor.objectives.items()}
            specialist_domains = [domain for specialist in cell.specialists for domain in specialist.domains]
            local_relation = fmean(relations_by_actor[actor.actor_id]) if relations_by_actor[actor.actor_id] else 0.0
            scores: dict[str, float] = {}
            for action in brief.interventions:
                model = brief.intervention_models[action]
                affinity = model["objective_affinity"]
                objective_score = sum(normalized_objectives.get(key, 0.0) * float(value) for key, value in affinity.items())
                required = set(model.get("required_capabilities", ()))
                exposed = set(model.get("constraint_exposure", ()))
                capability_score = 0.15 * len(required.intersection(actor.capabilities))
                if required and not required.intersection(actor.capabilities):
                    capability_score -= 0.20
                constraint_penalty = 0.15 * len(exposed.intersection(actor.constraints))
                domain_score = 0.08 * specialist_domains.count(str(model["domain"]))
                cooperation = float(model["cooperation"])
                strategic_score = cooperation * (game_cooperation - 0.5) * 0.8
                relation_score = cooperation * local_relation * 0.25
                horizon_score = cooperation * (actor.time_preference - 0.8) * 0.5
                scores[action] = objective_score + capability_score - constraint_penalty + domain_score + strategic_score + relation_score + horizon_score
            temperature = 0.25 + actor.risk_tolerance * 0.75
            policies[actor.actor_id] = _softmax(scores, temperature)
        return policies, game_cooperation, relation_mean, float(qre["residual"])

    def run(
        self,
        brief: SimulationBrief,
        cells: Sequence[ActorCell],
        evidence_hash: str,
        evidence_effects: Mapping[str, Mapping[str, float]] | None = None,
        workflow: list[dict[str, Any]] | None = None,
        shock_scale: float = 0.08,
    ) -> SimulationResult:
        brief.validate()
        if len(cells) != len(brief.actor_ids) or len({cell.actor.actor_id for cell in cells}) != len(cells):
            raise ValueError("actor cells devem ter correspondência um-a-um com actor_ids")
        if {cell.actor.actor_id for cell in cells} != set(brief.actor_ids):
            raise ValueError("actor cells não correspondem ao briefing")
        if not isinstance(shock_scale, (int, float)) or not 0 < float(shock_scale) < 10:
            raise ValueError("shock_scale deve ser finito, positivo e limitado")

        evidence_effects = evidence_effects or {}
        year_fraction = self.unit_year_fraction[brief.step_unit]
        period_shock_scale = float(shock_scale) * sqrt(year_fraction)
        variable_names = sorted(brief.variables)
        cells_by_id = {cell.actor.actor_id: cell for cell in cells}
        policies, game_cooperation, relation_mean, qre_residual = self._actor_policies(brief, cells)
        paths: dict[str, list[float]] = {name: [] for name in variable_names}
        representative_trace: list[dict[str, Any]] = []
        event_counts = {"adverse_shift": 0, "high_volatility": 0, "cooperative_path": 0}
        scenario_counts = {str(rule["name"]): 0 for rule in brief.scenario_rules}
        actor_action_counts = {actor_id: {action: 0 for action in brief.interventions} for actor_id in sorted(brief.actor_ids)}
        family_event_counts = [{name: 0 for name in event_counts} for _ in range(3)]
        family_sizes = [0, 0, 0]
        cooperation_rates: list[float] = []

        for run_index in range(brief.runs):
            family = run_index % 3
            local_index = run_index // 3
            rng = random.Random(brief.seed + family * 1_000_003 + local_index * 7919)  # nosec B311
            state = {name: float(brief.variables[name]) for name in variable_names}
            run_trace: list[dict[str, Any]] = []
            cooperation_sum = 0.0
            primary_returns: list[float] = []
            family_sizes[family] += 1
            for step in range(1, brief.horizon_steps + 1):
                actions: dict[str, str] = {}
                action_cooperation: list[float] = []
                action_effects = {name: [] for name in variable_names}
                for actor_id in sorted(brief.actor_ids):
                    policy = policies[actor_id]
                    draw = rng.random()
                    cumulative = 0.0
                    selected = brief.interventions[-1]
                    for action in brief.interventions:
                        cumulative += policy[action]
                        if draw <= cumulative:
                            selected = action
                            break
                    actions[actor_id] = selected
                    actor_action_counts[actor_id][selected] += 1
                    model = brief.intervention_models[selected]
                    action_cooperation.append(float(model["cooperation"]))
                    actor_factor = 0.75 + 0.25 * cells_by_id[actor_id].actor.time_preference
                    for name in variable_names:
                        action_effects[name].append(actor_factor * float(model["variable_effects"].get(name, 0.0)))
                cooperation_rate = (fmean(action_cooperation) + 1.0) / 2.0
                cooperation_sum += cooperation_rate
                common_shock = rng.gauss(0.0, period_shock_scale)
                next_state: dict[str, float] = {}
                for name in variable_names:
                    value = state[name]
                    baseline = float(brief.variables[name])
                    model = brief.variable_models[name]
                    evidence = evidence_effects.get(name, {})
                    annual_drift = float(model.get("annual_drift", 0.0)) + float(evidence.get("annual_drift_delta", 0.0))
                    shock_multiplier = float(evidence.get("shock_multiplier", 1.0))
                    shock_loading = float(model.get("shock_loading", 1.0)) * shock_multiplier
                    cooperation_loading = float(model.get("cooperation_loading", 0.0))
                    mean_reversion = float(model.get("mean_reversion", 0.0))
                    periodic_reversion = 1.0 - (1.0 - min(max(mean_reversion, 0.0), 0.999999)) ** year_fraction
                    idiosyncratic = rng.gauss(0.0, period_shock_scale * 0.6)
                    strategic_rate = fmean(action_effects[name]) if action_effects[name] else 0.0
                    relation_rate = relation_mean * cooperation_loading * (cooperation_rate - 0.5)
                    relative_change = annual_drift * year_fraction + strategic_rate * year_fraction + relation_rate * year_fraction + common_shock * shock_loading + idiosyncratic
                    updated = value + max(abs(value), 1.0) * relative_change + periodic_reversion * (baseline - value)
                    if "floor" in model:
                        updated = max(updated, float(model["floor"]))
                    if "ceiling" in model:
                        updated = min(updated, float(model["ceiling"]))
                    next_state[name] = updated
                previous_primary = state[brief.primary_variable]
                current_primary = next_state[brief.primary_variable]
                primary_returns.append((current_primary - previous_primary) / max(abs(previous_primary), 1e-12))
                if run_index == 0:
                    run_trace.append({"step": step, "unit": brief.step_unit, "actions": actions, "cooperation_rate": cooperation_rate, "common_shock": common_shock, "state": next_state.copy()})
                state = next_state
            average_cooperation = cooperation_sum / brief.horizon_steps
            cooperation_rates.append(average_cooperation)
            for name, value in state.items():
                paths[name].append(value)
            matched_scenario = None
            for rule in brief.scenario_rules:
                if _matches_rule(state[str(rule["variable"])], rule):
                    matched_scenario = str(rule["name"])
                    break
            if matched_scenario is None:
                matched_scenario = "central"
            scenario_counts[matched_scenario] += 1
            adverse = matched_scenario == "adverse"
            annualized_volatility = pstdev(primary_returns) / sqrt(year_fraction) if len(primary_returns) > 1 else abs(primary_returns[0]) / sqrt(year_fraction)
            high_volatility = annualized_volatility >= float(brief.event_thresholds["high_volatility"])
            cooperative_path = average_cooperation >= float(brief.event_thresholds["cooperative_path"])
            outcomes = {"adverse_shift": adverse, "high_volatility": high_volatility, "cooperative_path": cooperative_path}
            for event, occurred in outcomes.items():
                if occurred:
                    event_counts[event] += 1
                    family_event_counts[family][event] += 1
            if run_index == 0:
                representative_trace = run_trace

        quantiles: dict[str, dict[str, float]] = {}
        for index, (name, values) in enumerate(paths.items()):
            quantiles[name] = {
                "p10": quantile(values, 0.10),
                "p10_mcse": bootstrap_quantile_mcse(values, 0.10, brief.seed + index * 101),
                "p50": quantile(values, 0.50),
                "p50_mcse": bootstrap_quantile_mcse(values, 0.50, brief.seed + index * 101 + 1),
                "p90": quantile(values, 0.90),
                "p90_mcse": bootstrap_quantile_mcse(values, 0.90, brief.seed + index * 101 + 2),
                "mean": fmean(values),
                "std": pstdev(values),
            }
        event_uncertainty = {name: binomial_uncertainty(count, brief.runs) for name, count in event_counts.items()}
        probabilities = {name: values["probability"] for name, values in event_uncertainty.items()}
        scenario_rule_map = {str(rule["name"]): rule for rule in brief.scenario_rules}
        scenarios = []
        for name, count in scenario_counts.items():
            uncertainty = binomial_uncertainty(count, brief.runs)
            rule = scenario_rule_map[name]
            scenarios.append(ScenarioSummary(name, uncertainty["probability"], str(rule["trigger"]), (f"{rule['variable']} {rule['operator']} {rule['thresholds']}",), count, uncertainty["mcse"], uncertainty["ci95_low"], uncertainty["ci95_high"]))
        action_frequencies = {
            actor_id: {action: count / (brief.runs * brief.horizon_steps) for action, count in counts.items()}
            for actor_id, counts in actor_action_counts.items()
        }
        family_probabilities = []
        for family in range(3):
            family_probabilities.append({event: family_event_counts[family][event] / family_sizes[family] for event in event_counts})
        max_seed_spread = max(max(item[event] for item in family_probabilities) - min(item[event] for item in family_probabilities) for event in event_counts)
        model_payload = {
            "problem": brief.problem,
            "game_form": brief.game_form,
            "primary_variable": brief.primary_variable,
            "variable_models": brief.variable_models,
            "intervention_models": brief.intervention_models,
            "relations": brief.relations,
            "scenario_rules": brief.scenario_rules,
            "evidence_effects": evidence_effects,
        }
        model_signature = sha256(json.dumps(model_payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
        warnings = [
            "Resultados condicionais e experimentais; não constituem recomendação financeira ou política.",
            "Coeficientes do domain pack demonstrativo ainda precisam de calibração point-in-time para uso preditivo.",
        ]
        if max_seed_spread > 0.15:
            warnings.append(f"Gate de estabilidade: dispersão entre famílias de seed elevada ({max_seed_spread:.3f}).")
        return SimulationResult(
            study_name=brief.name,
            cutoff=brief.cutoff,
            runs=brief.runs,
            seed=brief.seed,
            horizon_steps=brief.horizon_steps,
            quantiles=quantiles,
            event_probabilities=probabilities,
            event_uncertainty=event_uncertainty,
            scenarios=scenarios,
            actor_action_frequencies=action_frequencies,
            trace=representative_trace,
            workflow=workflow or [],
            method={
                "engine": "structured_semantic_domain_pack_mvp",
                "policy": "actor_softmax_plus_logit_qre",
                "game_form": brief.game_form,
                "qre_converged": True,
                "qre_residual": qre_residual,
                "evidence_snapshot_sha256": evidence_hash,
                "model_signature_sha256": model_signature,
                "shock_scale_annual": shock_scale,
                "period_shock_scale": period_shock_scale,
                "unit_year_fraction": year_fraction,
                "probability_status": "model_implied_with_mcse_not_yet_empirically_calibrated",
                "mean_cooperation": fmean(cooperation_rates),
                "game_cooperation_baseline": game_cooperation,
                "relation_mean": relation_mean,
                "seed_families": family_probabilities,
                "max_seed_spread": max_seed_spread,
            },
            warnings=warnings,
        )
