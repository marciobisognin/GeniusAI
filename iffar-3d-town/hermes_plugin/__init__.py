"""Plug-in nativo do Hermes para extração normativa em PDF.

Complementa o servidor MCP `genius-organograma`: este plug-in transforma o PDF
da portaria em estrutura; o MCP decide, sobre essa estrutura, cobertura (Lei
1), agentes, squads e workflows. A divisão não é arbitrária — os extratores são
Python (pdfplumber/pypdf), então entram como plug-in nativo; o compilador é
TypeScript, então entra por MCP. Ver `docs/ANALISE-PLUGINS-HERMES.md` §3.2 e §3.6.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

from . import schemas, tools

__all__ = ["TOOLSET", "TOOLS", "SKILL_PATH", "register"]

TOOLSET = "organograma"

TOOLS: tuple[tuple[str, dict[str, Any], Any], ...] = (
    ("org_extract_pdf", schemas.EXTRACT_PDF, tools.extract_pdf),
    ("org_extract_competencias", schemas.EXTRACT_COMPETENCIAS, tools.extract_competencias),
)

SKILL_PATH = Path(__file__).resolve().parent / "skills" / "organograma-normativo" / "SKILL.md"


def register(ctx: Any) -> None:
    """Registra as ferramentas de extração e a skill do fluxo normativo."""
    for name, schema, handler in TOOLS:
        ctx.register_tool(name=name, toolset=TOOLSET, schema=schema, handler=handler)

    register_skill = getattr(ctx, "register_skill", None)
    if callable(register_skill) and SKILL_PATH.is_file():
        register_skill("organograma-normativo", SKILL_PATH)
