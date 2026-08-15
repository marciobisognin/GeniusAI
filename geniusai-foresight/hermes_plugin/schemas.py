"""Descrições das ferramentas lidas pelo modelo para decidir quando chamá-las.

O texto de cada `description` é contrato com o LLM, não documentação interna:
ele precisa dizer o que a ferramenta faz, o que devolve e — quando existe —
qual é o limite honesto do resultado.
"""
from __future__ import annotations

from typing import Any

# Os quatro jogos canônicos embutidos no kernel (`foresight.cli.FIXTURES`).
# `tests/test_hermes_plugin.py` garante que esta lista não se descole da fonte.
GAME_FIXTURES = ("chicken", "matching-pennies", "prisoners-dilemma", "stag-hunt")

_STUDY_PROPERTIES: dict[str, Any] = {
    "study": {
        "type": "object",
        "description": (
            "Estudo completo em JSON, com as chaves 'brief', 'actors' e "
            "'evidence' (e opcionalmente 'domains'). Use esta chave OU "
            "'study_path', nunca as duas."
        ),
    },
    "study_path": {
        "type": "string",
        "description": (
            "Caminho de um arquivo .json de estudo já existente no disco. "
            "Use esta chave OU 'study', nunca as duas."
        ),
    },
}


def _study_tool(name: str, description: str, extra: dict[str, Any] | None = None, required: tuple[str, ...] = ()) -> dict[str, Any]:
    properties = dict(_STUDY_PROPERTIES)
    properties.update(extra or {})
    return {
        "name": name,
        "description": description,
        "parameters": {"type": "object", "properties": properties, "required": list(required)},
    }


VALIDATE = _study_tool(
    "foresight_validate",
    "Valida um estudo prospectivo contra os contratos do kernel e o gate de "
    "entrada, SEM executar a simulação (barato). Devolve o nome do estudo, a "
    "quantidade de atores, quantas evidências sobrevivem à data de corte e o "
    "hash SHA-256 do snapshot de evidências. Use antes de 'foresight_run' "
    "para descobrir erros de contrato sem pagar o custo da simulação.",
)

PROFILE = _study_tool(
    "foresight_profile",
    "Mostra as células adaptativas de agentes que o kernel monta para um "
    "estudo: por ator, o coordenador e os especialistas por domínio, mais as "
    "instituições consideradas. Não executa a simulação. Use para explicar "
    "quem vai 'raciocinar' por cada ator antes de rodar.",
)

RUN = _study_tool(
    "foresight_run",
    "Executa o estudo completo (as oito etapas do ciclo) e escreve os "
    "relatórios auditáveis em disco: result.json, report.md e report.html. "
    "IMPORTANTE: o gate científico é obrigatório — se o red team não devolver "
    "'go_research_only', nada é publicado e a resposta vem com "
    "status 'blocked_by_gate' e o motivo. Os resultados são condicionais e "
    "rotulados como research-only: não são recomendação financeira ou "
    "política.",
    extra={
        "output_dir": {
            "type": "string",
            "description": "Diretório onde escrever result.json, report.md e report.html.",
        },
        "force": {
            "type": "boolean",
            "description": "Sobrescrever artefatos já existentes no diretório de saída. Padrão: false.",
        },
    },
    required=("output_dir",),
)

DEMO = {
    "name": "foresight_demo",
    "description": (
        "Executa o cenário demonstrativo embutido (choque de soja e "
        "reposicionamento comercial: 5 atores, 600 runs) e escreve os "
        "relatórios. Use quando o usuário quiser ver o Foresight funcionando "
        "sem ter um estudo próprio pronto, ou para conferir se o kernel está "
        "instalado e saudável."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "output_dir": {
                "type": "string",
                "description": "Diretório onde escrever os artefatos da demonstração.",
            },
            "force": {
                "type": "boolean",
                "description": "Sobrescrever artefatos já existentes. Padrão: false.",
            },
        },
        "required": ["output_dir"],
    },
}

GAME = {
    "name": "foresight_game",
    "description": (
        "Analisa um jogo canônico 2x2 e devolve os equilíbrios: Nash puro, "
        "Nash misto, estratégias estritamente dominadas, resultados "
        "Pareto-eficientes e o equilíbrio quantal (QRE logit). Use para "
        "raciocinar sobre uma interação estratégica isolada, sem montar um "
        "estudo inteiro."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "fixture": {
                "type": "string",
                "enum": list(GAME_FIXTURES),
                "description": "Qual jogo canônico analisar.",
            },
        },
        "required": ["fixture"],
    },
}

REPLAY = _study_tool(
    "foresight_replay",
    "Verifica o determinismo de uma execução anterior: reconstrói a run a "
    "partir do estudo e compara o hash SHA-256 canônico com um result.json já "
    "gravado. Devolve 'match' ou 'mismatch' com os dois hashes. Use para "
    "auditar se um relatório publicado ainda é reproduzível.",
    extra={
        "expected_path": {
            "type": "string",
            "description": "Caminho do result.json produzido por uma execução anterior.",
        },
    },
    required=("expected_path",),
)
