"""Plug-in de memória do Genius Allspark para o Hermes Agent.

Porte de `packages/learning` (TypeScript) para o ponto de extensão de memória
do Hermes. O embedding é idêntico ao do lado TypeScript — garantido por
`tests/test_parity.py` contra uma fixture gerada pelo próprio TypeScript —, de
modo que os dois motores leem o mesmo significado.

Ver `docs/ANALISE-PLUGINS-HERMES.md` §3.3.
"""
from __future__ import annotations

from typing import Any

from .provider import DEFAULT_DB, GeniusMemoryProvider
from .store import SOURCE_TYPES, MemoryStore

__all__ = ["DEFAULT_DB", "SOURCE_TYPES", "GeniusMemoryProvider", "MemoryStore", "register"]

TOOLSET = "memory"


def register(ctx: Any) -> None:
    """Registra o provider de memória e as duas ferramentas que ele expõe."""
    db_path = None
    get_config = getattr(ctx, "get_config", None)
    if callable(get_config):
        db_path = get_config("db_path", default=None) or None
        prefetch_k = get_config("prefetch_k", default=5) or 5
    else:
        prefetch_k = 5

    provider = GeniusMemoryProvider(db_path, prefetch_k=int(prefetch_k))

    register_provider = getattr(ctx, "register_memory_provider", None)
    if callable(register_provider):
        register_provider(provider)

    handlers = {"memory_search": provider.handle_search, "memory_index": provider.handle_index}
    for schema in provider.get_tool_schemas():
        ctx.register_tool(
            name=schema["name"],
            toolset=TOOLSET,
            schema=schema,
            handler=handlers[schema["name"]],
        )
