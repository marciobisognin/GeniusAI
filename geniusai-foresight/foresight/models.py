"""Typed contracts for studies, actors, evidence and simulation outputs."""
from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from math import isfinite
from typing import Any, Literal
from urllib.parse import urlparse

ActorKind = Literal["country", "organization", "market", "institution", "non_state", "historical"]
STEP_UNITS = {"day", "week", "month", "year"}
ACTOR_KINDS = {"country", "organization", "market", "institution", "non_state", "historical"}
GAME_FORMS = {"normal", "bayesian", "repeated", "stochastic", "bayesian_stochastic", "bayesian_stochastic_repeated", "stackelberg", "coalitional"}


def parse_time(value: str) -> datetime:
    """Parse an ISO-8601 timestamp and require timezone awareness."""
    if not isinstance(value, str) or len(value) > 64:
        raise ValueError("timestamp inválido")
    normalized = value.replace("Z", "+00:00")
    parsed = datetime.fromisoformat(normalized)
    if parsed.tzinfo is None:
        raise ValueError(f"timestamp sem timezone: {value}")
    return parsed.astimezone(timezone.utc)


def _finite(value: Any, label: str) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not isfinite(float(value)):
        raise ValueError(f"{label} deve ser número finito")
    return float(value)


def _bounded_text(value: Any, label: str, maximum: int, *, required: bool = True) -> str:
    if not isinstance(value, str) or (required and not value.strip()) or len(value) > maximum:
        raise ValueError(f"{label} inválido ou maior que {maximum} caracteres")
    return value


@dataclass(frozen=True)
class EvidenceRecord:
    evidence_id: str
    claim: str
    entity: str
    variable: str
    event_time: str
    release_time: str
    source_url: str
    source_type: str = "official"
    reliability: float = 0.5
    directness: float = 0.5
    independent_group: str = "unknown"
    revision_id: str = "v1"
    captured_time: str | None = None
    valid_from: str | None = None
    valid_to: str | None = None
    supersedes: str | None = None
    license: str = "unknown"
    metadata: dict[str, Any] = field(default_factory=dict)

    def validate(self) -> None:
        _bounded_text(self.evidence_id, "evidence_id", 128)
        _bounded_text(self.revision_id, "revision_id", 64)
        _bounded_text(self.claim, "claim", 10_000)
        _bounded_text(self.entity, "entity", 256)
        _bounded_text(self.variable, "variable", 128)
        parse_time(self.event_time)
        release = parse_time(self.release_time)
        captured = parse_time(self.captured_time or self.release_time)
        if captured < release:
            raise ValueError("captured_time não pode preceder release_time")
        valid_from = parse_time(self.valid_from or self.event_time)
        if self.valid_to and parse_time(self.valid_to) <= valid_from:
            raise ValueError("valid_to precisa ser posterior a valid_from")
        parsed = urlparse(_bounded_text(self.source_url, "source_url", 2048))
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise ValueError("source_url deve usar HTTP(S) com host")
        for name, value in (("reliability", self.reliability), ("directness", self.directness)):
            numeric = _finite(value, name)
            if not 0.0 <= numeric <= 1.0:
                raise ValueError(f"{name} deve estar entre 0 e 1")
        if not isinstance(self.metadata, dict) or len(self.metadata) > 100:
            raise ValueError("metadata inválida ou excessiva")


@dataclass(frozen=True)
class ActorDefinition:
    actor_id: str
    name: str
    kind: ActorKind
    governance: str
    objectives: dict[str, float]
    capabilities: tuple[str, ...] = ()
    constraints: tuple[str, ...] = ()
    institutions: tuple[str, ...] = ()
    risk_tolerance: float = 0.5
    time_preference: float = 0.95
    evidence_ids: tuple[str, ...] = ()

    def validate(self) -> None:
        _bounded_text(self.actor_id, "actor_id", 80)
        _bounded_text(self.name, "name", 256)
        _bounded_text(self.governance, "governance", 128)
        if any(ch not in "abcdefghijklmnopqrstuvwxyz0123456789-_" for ch in self.actor_id):
            raise ValueError(f"actor_id inválido: {self.actor_id}")
        if self.kind not in ACTOR_KINDS:
            raise ValueError("kind inválido")
        risk = _finite(self.risk_tolerance, "risk_tolerance")
        discount = _finite(self.time_preference, "time_preference")
        if not 0 <= risk <= 1:
            raise ValueError("risk_tolerance deve estar entre 0 e 1")
        if not 0 < discount <= 1:
            raise ValueError("time_preference deve estar em (0,1]")
        if not self.objectives or len(self.objectives) > 50:
            raise ValueError("ator exige entre 1 e 50 objetivos")
        total = 0.0
        for name, value in self.objectives.items():
            _bounded_text(name, "objective_id", 128)
            numeric = _finite(value, f"objective:{name}")
            if numeric < 0:
                raise ValueError("pesos de objetivos não podem ser negativos")
            total += numeric
        if total <= 0:
            raise ValueError("soma dos objetivos deve ser positiva")
        for label, values in (("capabilities", self.capabilities), ("constraints", self.constraints), ("institutions", self.institutions)):
            if len(values) > 100 or len(set(values)) != len(values):
                raise ValueError(f"{label} excessivo ou duplicado")
            for item in values:
                _bounded_text(item, label, 128)


@dataclass(frozen=True)
class SpecialistAgent:
    agent_id: str
    actor_id: str
    role: str
    objective: str
    domains: tuple[str, ...]
    weight: float


@dataclass(frozen=True)
class ActorCell:
    actor: ActorDefinition
    coordinator: SpecialistAgent
    specialists: tuple[SpecialistAgent, ...]


@dataclass(frozen=True)
class ForecastContract:
    contract_id: str
    question: str
    target_variable: str
    cutoff: str
    resolution_time: str
    resolution_source: str
    outcome_type: Literal["binary", "continuous", "categorical"]

    def validate(self) -> None:
        if parse_time(self.resolution_time) <= parse_time(self.cutoff):
            raise ValueError("resolution_time precisa ser posterior ao cutoff")
        _bounded_text(self.question, "question", 10_000)
        _bounded_text(self.target_variable, "target_variable", 128)
        parsed = urlparse(_bounded_text(self.resolution_source, "resolution_source", 2048))
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise ValueError("resolution_source inválida")


@dataclass(frozen=True)
class SimulationBrief:
    name: str
    problem: str
    cutoff: str
    horizon_steps: int
    step_unit: Literal["day", "week", "month", "year"]
    actor_ids: tuple[str, ...]
    variables: dict[str, float]
    primary_variable: str
    variable_models: dict[str, dict[str, Any]]
    intervention_models: dict[str, dict[str, Any]]
    relations: tuple[dict[str, Any], ...]
    scenario_rules: tuple[dict[str, Any], ...]
    event_thresholds: dict[str, float]
    forecast_contract: dict[str, Any]
    runs: int = 500
    seed: int = 42
    game_form: str = "bayesian_stochastic"
    interventions: tuple[str, ...] = ()

    def validate(self) -> None:
        _bounded_text(self.name, "name", 256)
        _bounded_text(self.problem, "problem", 10_000)
        parse_time(self.cutoff)
        if isinstance(self.horizon_steps, bool) or not isinstance(self.horizon_steps, int) or self.horizon_steps < 1:
            raise ValueError("horizon_steps deve ser inteiro positivo")
        if self.step_unit not in STEP_UNITS:
            raise ValueError("step_unit inválido")
        if isinstance(self.runs, bool) or not isinstance(self.runs, int) or not 1 <= self.runs <= 100_000:
            raise ValueError("runs deve estar entre 1 e 100000")
        if self.horizon_steps > 10_000 or self.runs * self.horizon_steps > 10_000_000:
            raise ValueError("budget excedido: reduza runs ou horizon_steps")
        if not 2 <= len(self.actor_ids) <= 50 or len(set(self.actor_ids)) != len(self.actor_ids):
            raise ValueError("actor_ids exige 2..50 IDs únicos")
        for actor_id in self.actor_ids:
            _bounded_text(actor_id, "actor_id", 80)
        if not 1 <= len(self.variables) <= 100:
            raise ValueError("variables exige 1..100 entradas")
        for name, value in self.variables.items():
            _bounded_text(name, "variable_id", 128)
            _finite(value, f"variable:{name}")
        if self.primary_variable not in self.variables:
            raise ValueError("primary_variable precisa existir em variables")
        if set(self.variable_models) != set(self.variables):
            raise ValueError("variable_models deve cobrir exatamente variables")
        allowed_coefficients = {"annual_drift", "shock_loading", "cooperation_loading", "mean_reversion", "floor", "ceiling"}
        for variable, model in self.variable_models.items():
            if not isinstance(model, dict) or not set(model).issubset(allowed_coefficients):
                raise ValueError(f"variable_model inválido: {variable}")
            for key, value in model.items():
                numeric = _finite(value, f"{variable}.{key}")
                if key == "shock_loading" and numeric < 0:
                    raise ValueError("shock_loading não pode ser negativo")
                if key == "mean_reversion" and not 0 <= numeric <= 1:
                    raise ValueError("mean_reversion deve estar em [0,1]")
            if "floor" in model and "ceiling" in model and float(model["floor"]) >= float(model["ceiling"]):
                raise ValueError("floor precisa ser menor que ceiling")
        if self.game_form not in GAME_FORMS:
            raise ValueError("game_form inválido")
        if not 1 <= len(self.interventions) <= 20 or len(set(self.interventions)) != len(self.interventions):
            raise ValueError("interventions exige 1..20 IDs únicos")
        if not set(self.interventions).issubset(self.intervention_models):
            raise ValueError("intervention_models não cobre interventions")
        for action, model in self.intervention_models.items():
            _bounded_text(action, "intervention_id", 128)
            if not isinstance(model, dict):
                raise ValueError("intervention model inválido")
            for key in ("cooperation", "domain", "objective_affinity", "variable_effects"):
                if key not in model:
                    raise ValueError(f"intervention {action} sem {key}")
            cooperation = _finite(model["cooperation"], f"{action}.cooperation")
            if not -1 <= cooperation <= 1:
                raise ValueError("cooperation deve estar em [-1,1]")
            _bounded_text(model["domain"], f"{action}.domain", 128)
            for mapping_name in ("objective_affinity", "variable_effects"):
                mapping = model[mapping_name]
                if not isinstance(mapping, dict) or len(mapping) > 100:
                    raise ValueError(f"{action}.{mapping_name} inválido")
                if mapping_name == "variable_effects" and not set(mapping).issubset(self.variables):
                    raise ValueError(f"{action}.variable_effects contém variável desconhecida")
                for key, value in mapping.items():
                    _bounded_text(key, mapping_name, 128)
                    _finite(value, f"{action}.{mapping_name}.{key}")
            for list_name in ("required_capabilities", "constraint_exposure"):
                values = model.get(list_name, ())
                if not isinstance(values, (list, tuple)) or len(values) > 50:
                    raise ValueError(f"{action}.{list_name} inválido")
        if len(self.relations) > 1_225:
            raise ValueError("relations excede limite")
        seen_relations: set[tuple[str, str]] = set()
        for relation in self.relations:
            source, target = relation.get("source"), relation.get("target")
            if source not in self.actor_ids or target not in self.actor_ids or source == target:
                raise ValueError("relation contém ator inválido")
            pair = tuple(sorted((source, target)))
            if pair in seen_relations:
                raise ValueError("relation duplicada")
            seen_relations.add(pair)
            strength = _finite(relation.get("strength"), "relation.strength")
            if not -1 <= strength <= 1:
                raise ValueError("relation strength deve estar em [-1,1]")
        rule_names = set()
        for rule in self.scenario_rules:
            name = _bounded_text(rule.get("name"), "scenario.name", 128)
            if name in rule_names:
                raise ValueError("scenario name duplicado")
            rule_names.add(name)
            if rule.get("variable") not in self.variables or rule.get("operator") not in {"lt", "lte", "between", "gte", "gt"}:
                raise ValueError("scenario rule inválida")
            thresholds = rule.get("thresholds")
            if not isinstance(thresholds, list) or not 1 <= len(thresholds) <= 2:
                raise ValueError("scenario thresholds inválidos")
            for value in thresholds:
                _finite(value, "scenario.threshold")
            _bounded_text(rule.get("trigger"), "scenario.trigger", 1000)
        if not {"adverse", "central", "favorable"}.issubset(rule_names):
            raise ValueError("scenario_rules deve incluir adverse, central e favorable")
        for key in ("high_volatility", "cooperative_path"):
            value = _finite(self.event_thresholds.get(key), f"event_thresholds.{key}")
            if value < 0:
                raise ValueError("event threshold não pode ser negativo")
        if not isinstance(self.forecast_contract, dict):
            raise ValueError("forecast_contract inválido")
        contract = ForecastContract(**self.forecast_contract)
        contract.validate()
        if contract.cutoff != self.cutoff or contract.target_variable != self.primary_variable:
            raise ValueError("forecast_contract precisa usar cutoff e primary_variable do briefing")
        if not isinstance(self.seed, int) or isinstance(self.seed, bool):
            raise ValueError("seed deve ser inteiro")


@dataclass(frozen=True)
class ScenarioSummary:
    name: str
    probability: float
    trigger: str
    indicators: tuple[str, ...]
    count: int
    mcse: float
    ci95_low: float
    ci95_high: float


@dataclass
class SimulationResult:
    study_name: str
    cutoff: str
    runs: int
    seed: int
    horizon_steps: int
    quantiles: dict[str, dict[str, float]]
    event_probabilities: dict[str, float]
    event_uncertainty: dict[str, dict[str, float]]
    scenarios: list[ScenarioSummary]
    actor_action_frequencies: dict[str, dict[str, float]]
    trace: list[dict[str, Any]]
    workflow: list[dict[str, Any]]
    method: dict[str, Any]
    warnings: list[str]

    def to_dict(self) -> dict[str, Any]:
        payload = asdict(self)
        payload["scenarios"] = [asdict(s) for s in self.scenarios]
        return payload
