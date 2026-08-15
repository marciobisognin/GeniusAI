"""Handlers das ferramentas.

Duas regras do contrato do Hermes valem para todos os handlers deste módulo,
e os testes cobrem as duas:

1. **Sempre devolvem uma string JSON** — inclusive no erro. Nenhum handler
   levanta exceção para fora; um erro vira `{"status": "error", ...}`, o mesmo
   envelope que a CLI do kernel já usa.
2. **Sempre aceitam `**kwargs`**, para o Hermes poder passar parâmetros novos
   sem quebrar o plug-in.

O kernel é importado tarde, dentro de `_kernel()`, e não no topo do módulo: o
plug-in precisa carregar (e `hermes plugins doctor` precisa passar) mesmo numa
instalação onde `geniusai-foresight` ainda não foi instalado — o usuário
descobre isso por uma mensagem de erro legível na primeira chamada, não por um
traceback no boot do agente.
"""
from __future__ import annotations

from contextlib import contextmanager
import functools
import json
import os
from pathlib import Path
import tempfile
from typing import Any, Callable, Iterator

_KERNEL_HINT = (
    "kernel do Foresight indisponível — instale com `pip install geniusai-foresight` "
    "(ou, a partir do repositório, `pip install ./geniusai-foresight`)"
)

#: Único status de gate que autoriza a publicação do relatório
#: (`foresight.orchestration.execute_workflow`).
GATE_GO = "go_research_only"


def _dumps(payload: Any) -> str:
    # `default=list` acompanha a CLI do kernel, que devolve tuplas e sets.
    return json.dumps(payload, ensure_ascii=False, default=list)


def _kernel():
    """Devolve o módulo `foresight.cli`, com erro legível se faltar o pacote."""
    try:
        from foresight import cli
    except ImportError as exc:  # pragma: no cover - depende do ambiente
        raise RuntimeError(f"{_KERNEL_HINT}: {exc}") from exc
    return cli


def _handler(func: Callable[..., Any]) -> Callable[..., str]:
    """Serializa o retorno e converte qualquer falha no envelope de erro.

    O `except Exception` amplo é deliberado: é exatamente o que o contrato do
    Hermes exige de um handler — nunca propagar exceção para o loop do agente.
    """

    @functools.wraps(func)
    def wrapper(args: dict[str, Any] | None = None, **kwargs: Any) -> str:
        try:
            return _dumps(func(args or {}, **kwargs))
        except Exception as exc:  # noqa: BLE001 - ver docstring
            return _dumps({"status": "error", "error": str(exc), "kind": type(exc).__name__})

    return wrapper


@contextmanager
def _study_path(args: dict[str, Any]) -> Iterator[Path]:
    """Resolve 'study' (inline) ou 'study_path' (disco) num caminho de arquivo.

    O estudo inline é gravado num arquivo temporário em vez de ser passado ao
    kernel em memória — de propósito. `foresight.cli.load_study` só aceita
    caminho, e com isso o conteúdo vindo do modelo passa pelas mesmas guardas
    de sempre: arquivo regular (não symlink), no máximo 5 MiB, constantes JSON
    não-finitas rejeitadas e no máximo 10 000 registros de evidência.
    """
    inline = args.get("study")
    given = args.get("study_path")
    if (inline is None) == (given is None):
        raise ValueError("informe exatamente um entre 'study' (JSON inline) e 'study_path' (caminho)")

    if given is not None:
        if not isinstance(given, str) or not given.strip():
            raise ValueError("'study_path' precisa ser um caminho não vazio")
        yield Path(given).expanduser()
        return

    if not isinstance(inline, dict):
        raise ValueError("'study' precisa ser um objeto JSON")
    handle, name = tempfile.mkstemp(prefix="foresight-study-", suffix=".json")
    temporary = Path(name)
    try:
        with os.fdopen(handle, "w", encoding="utf-8") as stream:
            json.dump(inline, stream, ensure_ascii=False)
        yield temporary
    finally:
        temporary.unlink(missing_ok=True)


def _output_dir(args: dict[str, Any]) -> Path:
    raw = args.get("output_dir")
    if not isinstance(raw, str) or not raw.strip():
        raise ValueError("'output_dir' é obrigatório e precisa ser um caminho não vazio")
    return Path(raw).expanduser()


def _execute(cli: Any, study: Path, output: Path, *, force: bool) -> dict[str, Any]:
    """Executa o ciclo e publica — a menos que o gate científico bloqueie.

    Espelha `foresight.cli.run_study`, com uma diferença que existe para o
    agente: quando o red team reprova, `run_study` levanta `ValueError` com o
    gate embutido na mensagem. Aqui o bloqueio vira um resultado estruturado,
    com o objeto `gate` intacto — a diferença entre "seu estudo está malformado"
    e "a ciência disse não" precisa ser legível por máquina, não por regex.
    """
    brief, _ledger, evidence, cells, result, gate = cli.execute_study(study)
    if gate.get("status") != GATE_GO:
        return {
            "status": "blocked_by_gate",
            "study": brief.name,
            "gate": gate,
            "hint": (
                "nenhum relatório foi escrito: o red team reprovou a execução "
                "(estabilidade entre sementes, convergência do QRE ou incerteza "
                "reportada). Ajuste o estudo e rode de novo."
            ),
        }
    paths = cli.write_reports(output, brief, result, cells, evidence, force=force)
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


@_handler
def validate(args: dict[str, Any], **kwargs: Any) -> dict[str, Any]:
    cli = _kernel()
    with _study_path(args) as study:
        brief, ledger, evidence, cells = cli.load_study(study)
    return {
        "status": "valid",
        "study": brief.name,
        "actors": len(cells),
        "evidence": len(evidence),
        "snapshot_sha256": ledger.snapshot_hash(brief.cutoff, strict=True),
    }


@_handler
def profile(args: dict[str, Any], **kwargs: Any) -> dict[str, Any]:
    cli = _kernel()
    with _study_path(args) as study:
        brief, _ledger, _evidence, cells = cli.load_study(study)
    return {
        "status": "profiled",
        "study": brief.name,
        "cells": [
            {
                "actor": cell.actor.name,
                "institutions": cell.actor.institutions,
                "coordinator": cell.coordinator.role,
                "specialists": [agent.role for agent in cell.specialists],
            }
            for cell in cells
        ],
    }


@_handler
def run(args: dict[str, Any], **kwargs: Any) -> dict[str, Any]:
    cli = _kernel()
    output = _output_dir(args)
    force = bool(args.get("force", False))
    with _study_path(args) as study:
        return _execute(cli, study, output, force=force)


@_handler
def demo(args: dict[str, Any], **kwargs: Any) -> dict[str, Any]:
    cli = _kernel()
    output = _output_dir(args)
    force = bool(args.get("force", False))
    return _execute(cli, cli.demo_input_path(), output, force=force)


@_handler
def game(args: dict[str, Any], **kwargs: Any) -> dict[str, Any]:
    cli = _kernel()
    fixture = args.get("fixture")
    if not isinstance(fixture, str) or not fixture:
        raise ValueError("'fixture' é obrigatório")
    # A validação de nome fica com o kernel: uma fixture nova lá aparece aqui
    # sem precisar editar o plug-in.
    return {"status": "analyzed"} | cli.game_analysis(fixture)


@_handler
def replay(args: dict[str, Any], **kwargs: Any) -> dict[str, Any]:
    cli = _kernel()
    expected = args.get("expected_path")
    if not isinstance(expected, str) or not expected.strip():
        raise ValueError("'expected_path' é obrigatório e precisa ser um caminho não vazio")
    with _study_path(args) as study:
        return cli.replay_study(study, Path(expected).expanduser())
