"""Adaptive institutional profiling and actor-cell generation."""
from __future__ import annotations

from collections.abc import Iterable

from .models import ActorCell, ActorDefinition, ActorKind, SpecialistAgent

DOMAIN_ROLES: dict[str, tuple[str, str]] = {
    "economy": ("economy-finance", "Avaliar produção, comércio, fiscal, moeda e restrições financeiras."),
    "market": ("market-liquidity", "Modelar preços, liquidez, posicionamento, contágio e expectativas."),
    "diplomacy": ("diplomacy-negotiation", "Avaliar alianças, negociação, sinais, tratados e reputação."),
    "security": ("security-strategy", "Avaliar segurança agregada, dissuasão, escalada e red lines."),
    "resources": ("resources-logistics", "Avaliar energia, alimentos, minerais, água, estoques e logística."),
    "domestic": ("domestic-politics", "Avaliar coalizões internas, legislativo, eleições e opinião pública."),
    "science": ("science-technology", "Avaliar tecnologia, inovação, dependências e capacidade científica."),
    "climate": ("climate-resilience", "Avaliar clima, desastres, adaptação e riscos sistêmicos."),
}

GOVERNANCE_INSTITUTIONS: dict[str, tuple[str, ...]] = {
    "presidential_federal": ("executive", "legislature", "central_bank", "foreign_ministry", "regional_governments", "private_sector"),
    "parliamentary": ("cabinet", "parliament", "central_bank", "foreign_ministry", "coalition_parties", "private_sector"),
    "party_state": ("party_leadership", "state_council", "central_bank", "armed_forces", "state_enterprises", "provincial_governments"),
    "supranational": ("commission", "council", "parliament", "central_bank", "member_state_blocs", "sectoral_lobbies"),
    "market": ("asset_managers", "banks", "market_makers", "hedgers", "speculators", "regulators"),
    "historical": ("ruler", "court", "military", "merchants", "religious_authorities", "local_elites"),
}


class CountryProfiler:
    """Build a transparent profile from declared facts; never invent live data."""

    def build(self, actor_id: str, name: str, governance: str, objectives: dict[str, float], *, kind: ActorKind = "country", capabilities: Iterable[str] = (), constraints: Iterable[str] = (), institutions: Iterable[str] = (), risk_tolerance: float = 0.5, time_preference: float = 0.95, evidence_ids: Iterable[str] = ()) -> ActorDefinition:
        inferred = tuple(institutions) or GOVERNANCE_INSTITUTIONS.get(governance, ("executive", "finance", "diplomacy", "stakeholders"))
        actor = ActorDefinition(actor_id=actor_id, name=name, kind=kind, governance=governance, objectives=dict(objectives), capabilities=tuple(capabilities), constraints=tuple(constraints), institutions=inferred, risk_tolerance=risk_tolerance, time_preference=time_preference, evidence_ids=tuple(evidence_ids))
        actor.validate()
        return actor


class ActorClusterFactory:
    """Create a minimal, problem-dependent institutional cell per actor."""

    def build(self, actor: ActorDefinition, domains: Iterable[str]) -> ActorCell:
        actor.validate()
        coordinator = SpecialistAgent(agent_id=f"{actor.actor_id}-coordinator", actor_id=actor.actor_id, role="strategic-coordinator", objective="Integrar recomendações, restrições institucionais e utilidades do ator.", domains=("governance",), weight=1.0)
        selected: list[SpecialistAgent] = []
        unique_domains = list(dict.fromkeys(domains))
        for domain in unique_domains:
            if domain not in DOMAIN_ROLES:
                continue
            role, objective = DOMAIN_ROLES[domain]
            selected.append(SpecialistAgent(agent_id=f"{actor.actor_id}-{role}", actor_id=actor.actor_id, role=role, objective=objective, domains=(domain,), weight=1.0))
        # Every strategic cell has an adversarial reviewer, but no redundant fixed court.
        selected.append(SpecialistAgent(agent_id=f"{actor.actor_id}-contrarian", actor_id=actor.actor_id, role="contrarian-red-team", objective="Procurar premissas frágeis, opções ignoradas e consequências não pretendidas.", domains=("risk", "assumptions"), weight=0.75))
        return ActorCell(actor=actor, coordinator=coordinator, specialists=tuple(selected))
