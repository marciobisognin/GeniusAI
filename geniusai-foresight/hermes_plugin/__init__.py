"""Plug-in nativo do Hermes Agent para o kernel do GeniusAI Foresight.

Ponto de entrada único: `register(ctx)`, como manda o contrato de plug-in do
Hermes. Ver `README.md` neste diretório para instalação, e
`../../docs/ANALISE-PLUGINS-HERMES.md` §3.1 para o porquê deste ser o primeiro
plug-in do repositório.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

from . import schemas, tools

__all__ = ["TOOLSET", "TOOLS", "SKILL_PATH", "register"]

TOOLSET = "foresight"

#: (nome, schema, handler) — a fonte única do que este plug-in registra.
#: `plugin.yaml:provides_tools` precisa listar exatamente estes nomes, e um
#: teste garante isso.
TOOLS: tuple[tuple[str, dict[str, Any], Any], ...] = (
    ("foresight_validate", schemas.VALIDATE, tools.validate),
    ("foresight_profile", schemas.PROFILE, tools.profile),
    ("foresight_run", schemas.RUN, tools.run),
    ("foresight_demo", schemas.DEMO, tools.demo),
    ("foresight_game", schemas.GAME, tools.game),
    ("foresight_replay", schemas.REPLAY, tools.replay),
)

SKILL_PATH = Path(__file__).resolve().parent / "skills" / "foresight-cycle" / "SKILL.md"


def register(ctx: Any) -> None:
    """Registra as ferramentas e a skill do ciclo de prospecção no Hermes."""
    for name, schema, handler in TOOLS:
        ctx.register_tool(name=name, toolset=TOOLSET, schema=schema, handler=handler)

    # `register_skill` é opcional de propósito: numa build do Hermes que não a
    # exponha, o plug-in continua entregando as ferramentas em vez de falhar
    # inteiro no boot.
    register_skill = getattr(ctx, "register_skill", None)
    if callable(register_skill) and SKILL_PATH.is_file():
        register_skill("foresight-cycle", SKILL_PATH)
