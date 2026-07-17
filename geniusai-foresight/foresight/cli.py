"""Command-line interface for GeniusAI Foresight."""
from __future__ import annotations

import argparse
from hashlib import sha256
import json
from pathlib import Path
import sys
from typing import Any

from .actors import ActorClusterFactory, CountryProfiler
from .evidence import EvidenceLedger
from .game_theory import mixed_nash_2x2, pareto_efficient_outcomes, pure_nash_equilibria, qre_logit_2x2, strictly_dominated_actions
from .models import EvidenceRecord, SimulationBrief
from .orchestration import execute_workflow
from .reporting import write_reports

MAX_INPUT_BYTES = 5 * 1024 * 1024
FIXTURES = {
    "prisoners-dilemma": (((3, 3), (0, 5)), ((5, 0), (1, 1))),
    "matching-pennies": (((1, -1), (-1, 1)), ((-1, 1), (1, -1))),
    "stag-hunt": (((4, 4), (0, 3)), ((3, 0), (2, 2))),
    "chicken": (((3, 3), (1, 4)), ((4, 1), (0, 0))),
}


def _reject_json_constant(value: str):
    raise ValueError(f"constante JSON não finita: {value}")


def load_study(path: Path):
    if path.is_symlink() or not path.is_file():
        raise ValueError("input precisa ser arquivo regular")
    if path.stat().st_size > MAX_INPUT_BYTES:
        raise ValueError("input excede 5 MiB")
    payload = json.loads(path.read_text(encoding="utf-8"), parse_constant=_reject_json_constant)
    if not isinstance(payload, dict):
        raise ValueError("raiz do estudo deve ser objeto JSON")
    brief_data = dict(payload["brief"])
    for field in ("actor_ids", "interventions", "relations", "scenario_rules"):
        brief_data[field] = tuple(brief_data.get(field, ()))
    brief = SimulationBrief(**brief_data)
    brief.validate()
    raw_evidence = payload.get("evidence", [])
    if not isinstance(raw_evidence, list) or len(raw_evidence) > 10_000:
        raise ValueError("evidence deve ser lista com no máximo 10000 registros")
    ledger = EvidenceLedger(EvidenceRecord(**item) for item in raw_evidence)
    evidence = ledger.snapshot(brief.cutoff, strict=True)
    raw_actors = payload["actors"]
    if not isinstance(raw_actors, list) or len(raw_actors) != len(brief.actor_ids):
        raise ValueError("actors deve corresponder um-a-um a actor_ids")
    profiler = CountryProfiler()
    factory = ActorClusterFactory()
    cells = []
    domains = payload.get("domains", ("economy", "diplomacy"))
    if not isinstance(domains, list) or not 1 <= len(domains) <= 20:
        raise ValueError("domains inválido")
    for item in raw_actors:
        actor = profiler.build(
            actor_id=item["actor_id"],
            name=item["name"],
            kind=item.get("kind", "country"),
            governance=item["governance"],
            objectives=item["objectives"],
            capabilities=item.get("capabilities", ()),
            constraints=item.get("constraints", ()),
            institutions=item.get("institutions", ()),
            risk_tolerance=float(item.get("risk_tolerance", 0.5)),
            time_preference=float(item.get("time_preference", 0.95)),
            evidence_ids=item.get("evidence_ids", ()),
        )
        cells.append(factory.build(actor, domains))
    if len({cell.actor.actor_id for cell in cells}) != len(cells):
        raise ValueError("actors contém IDs duplicados")
    return brief, ledger, evidence, cells


def execute_study(input_path: Path):
    brief, ledger, evidence, cells = load_study(input_path)
    result, gate = execute_workflow(brief, ledger, cells)
    return brief, ledger, evidence, cells, result, gate


def run_study(input_path: Path, output_path: Path, *, force: bool = False) -> dict[str, Any]:
    brief, _, evidence, cells, result, gate = execute_study(input_path)
    if gate["status"] != "go_research_only":
        raise ValueError(f"gate científico bloqueou relatório: {gate}")
    paths = write_reports(output_path, brief, result, cells, evidence, force=force)
    return {
        "status": "completed_research_only",
        "study": brief.name,
        "actors": len(cells),
        "specialists": sum(1 + len(cell.specialists) for cell in cells),
        "runs": result.runs,
        "gate": gate,
        "model_signature_sha256": result.method["model_signature_sha256"],
        "outputs": paths,
        "warnings": result.warnings,
    }


def replay_study(input_path: Path, expected_path: Path) -> dict[str, Any]:
    if expected_path.is_symlink() or not expected_path.is_file():
        raise ValueError("expected precisa ser result.json regular")
    expected = json.loads(expected_path.read_text(encoding="utf-8"), parse_constant=_reject_json_constant)
    _, _, _, _, result, gate = execute_study(input_path)
    actual = result.to_dict()
    canonical_expected = json.dumps(expected, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    canonical_actual = json.dumps(actual, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    expected_hash = sha256(canonical_expected.encode()).hexdigest()
    actual_hash = sha256(canonical_actual.encode()).hexdigest()
    return {"status": "match" if expected_hash == actual_hash else "mismatch", "expected_sha256": expected_hash, "actual_sha256": actual_hash, "gate": gate}


def game_analysis(name: str) -> dict[str, Any]:
    if name not in FIXTURES:
        raise ValueError(f"fixture desconhecida: {name}")
    game = FIXTURES[name]
    qre = qre_logit_2x2(game, 1.0, 1.0)
    if not qre["converged"]:
        raise ValueError("QRE não convergiu")
    result = {"fixture": name, "pure_nash": pure_nash_equilibria(game), "dominated": strictly_dominated_actions(game), "pareto_efficient": pareto_efficient_outcomes(game), "qre": qre}
    try:
        result["mixed_nash"] = mixed_nash_2x2(game)
    except ValueError as exc:
        result["mixed_nash"] = {"status": "not_interior_or_degenerate", "reason": str(exc)}
    return result


def demo_input_path() -> Path:
    candidates = (
        Path(__file__).resolve().parents[1] / "examples/soy-trade-shock.json",
        Path(sys.prefix) / "share/doc/geniusai-foresight/soy-trade-shock.json",
    )
    for candidate in candidates:
        if candidate.is_file():
            return candidate
    raise ValueError("fixture demonstrativa não encontrada na fonte nem na instalação")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="geniusai-foresight", description="Simulação prospectiva multiagente auditável")
    sub = parser.add_subparsers(dest="command", required=True)
    for command, help_text in (("simulate", "Executa um estudo JSON"), ("report", "Executa e produz relatório auditável")):
        item = sub.add_parser(command, help=help_text)
        item.add_argument("--input", required=True, type=Path)
        item.add_argument("--output", required=True, type=Path)
        item.add_argument("--force", action="store_true")
    demo = sub.add_parser("demo", help="Executa o cenário demonstrativo")
    demo.add_argument("--output", type=Path, default=Path("generated/demo"))
    demo.add_argument("--force", action="store_true")
    game = sub.add_parser("game", help="Analisa um jogo canônico")
    game.add_argument("--fixture", choices=sorted(FIXTURES), default="prisoners-dilemma")
    profile = sub.add_parser("profile", help="Exibe as células adaptativas de um estudo")
    profile.add_argument("--input", required=True, type=Path)
    validate = sub.add_parser("validate", help="Valida contratos e gate de entrada")
    validate.add_argument("--input", required=True, type=Path)
    replay = sub.add_parser("replay", help="Reconstrói uma run e compara com result.json")
    replay.add_argument("--input", required=True, type=Path)
    replay.add_argument("--expected", required=True, type=Path)
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        if args.command in {"simulate", "report"}:
            result = run_study(args.input, args.output, force=args.force)
        elif args.command == "demo":
            result = run_study(demo_input_path(), args.output, force=args.force)
        elif args.command == "game":
            result = game_analysis(args.fixture)
        elif args.command == "profile":
            brief, _, _, cells = load_study(args.input)
            result = {"study": brief.name, "cells": [{"actor": cell.actor.name, "institutions": cell.actor.institutions, "coordinator": cell.coordinator.role, "specialists": [agent.role for agent in cell.specialists]} for cell in cells]}
        elif args.command == "validate":
            brief, ledger, evidence, cells = load_study(args.input)
            result = {"status": "valid", "study": brief.name, "actors": len(cells), "evidence": len(evidence), "snapshot_sha256": ledger.snapshot_hash(brief.cutoff, strict=True)}
        elif args.command == "replay":
            result = replay_study(args.input, args.expected)
        else:
            raise ValueError("comando desconhecido")
        print(json.dumps(result, ensure_ascii=False, indent=2, default=list))
        return 0 if result.get("status") != "mismatch" else 3
    except (ValueError, KeyError, TypeError, FileExistsError, OSError, json.JSONDecodeError) as exc:
        print(json.dumps({"status": "error", "error": str(exc)}, ensure_ascii=False))
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
