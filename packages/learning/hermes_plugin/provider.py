"""Memory provider do Hermes com procedência.

O que distingue este provider dos que já existem no ecossistema (`mem0`,
`Mnemosyne`, `hindsight`): eles guardam **conversas**; este guarda também
**execuções aprovadas por um humano**, e cada trecho sabe de qual run e de qual
aprovação nasceu. Num contexto institucional, "por que o agente sabia disso?"
é auditoria, não curiosidade — e a resposta aqui é um `sourceId` rastreável.

O contrato (`name`, `is_available`, `initialize`, `sync_turn`, `prefetch`,
`get_tool_schemas`) segue o guia de plug-ins do Hermes. A classe base abstrata
é importada de forma tolerante: se o Hermes não estiver instalado (por exemplo,
ao rodar os testes deste repositório), caímos para `object` e a classe continua
utilizável e testável.
"""
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any, Sequence

from .store import CANONICAL_SOURCE_TYPES, SOURCE_TYPES, MemoryStore

try:  # pragma: no cover - depende do ambiente do Hermes
    from hermes_agent.memory import MemoryProvider as _HermesMemoryProvider
except Exception:  # noqa: BLE001 - qualquer falha de import cai para o modo autônomo
    _HermesMemoryProvider = object  # type: ignore[assignment,misc]

DEFAULT_DB = "~/.hermes/genius-memory/memory.sqlite3"

#: Quando o agente busca contexto, execuções aprovadas valem mais que conversa
#: solta. A conversa entra só para completar o k pedido.
PREFETCH_PRIORITY = CANONICAL_SOURCE_TYPES


class GeniusMemoryProvider(_HermesMemoryProvider):  # type: ignore[misc,valid-type]
    """Memória indexada do Genius Allspark, com procedência de aprovação."""

    def __init__(self, db_path: str | Path | None = None, *, prefetch_k: int = 5) -> None:
        self._db_path = Path(os.environ.get("GENIUS_MEMORY_DB", db_path or DEFAULT_DB)).expanduser()
        self._store: MemoryStore | None = None
        self._session_id = ""
        self._prefetch_k = prefetch_k

    # ------------------------------------------------------------------ contrato

    @property
    def name(self) -> str:
        return "genius-memory"

    def is_available(self) -> bool:
        try:
            self.store
        except Exception:  # noqa: BLE001 - indisponibilidade não pode derrubar o agente
            return False
        return True

    def initialize(self, session_id: str = "", **kwargs: Any) -> None:
        self._session_id = session_id or ""
        self.store  # abre o banco cedo, para falhar no lugar certo

    def sync_turn(
        self,
        user_content: str = "",
        assistant_content: str = "",
        *,
        session_id: str = "",
        messages: Sequence[Any] | None = None,
        **kwargs: Any,
    ) -> None:
        """Guarda o turno como memória de conversa — procedência mais fraca.

        Conversa não é execução aprovada: entra com `sourceType: "conversation"`
        justamente para nunca ser confundida com conhecimento que passou por um
        humano.
        """
        session = session_id or self._session_id
        text = "\n".join(part for part in (user_content, assistant_content) if part).strip()
        if not text:
            return
        index = self.store.count("conversation")
        self.store.index_chunk(
            chunk_id=f"conv:{session or 'sem-sessao'}:{index}",
            text=text,
            source_type="conversation",
            source_id=session or "sem-sessao",
            session_id=session,
        )

    def prefetch(self, query: str, *, session_id: str = "", **kwargs: Any) -> str:
        """Contexto para a próxima chamada do modelo, aprovado primeiro."""
        hits = self.store.search(query, k=self._prefetch_k, source_types=PREFETCH_PRIORITY)
        if len(hits) < self._prefetch_k:
            seen = {hit.id for hit in hits}
            extra = self.store.search(query, k=self._prefetch_k, source_types=("conversation",))
            hits = hits + [hit for hit in extra if hit.id not in seen]
        hits = hits[: self._prefetch_k]
        if not hits:
            return ""

        lines = ["Memória do Genius Allspark (mais relevante primeiro):"]
        for hit in hits:
            origem = (
                f"aprovação {hit.source_id}"
                if hit.source_type == "approved-result"
                else f"{hit.source_type} {hit.source_id}"
            )
            lines.append(f"- [{origem}] {hit.text}")
        lines.append(
            "Procedência acima é literal: 'aprovação' e 'learning-flow' vieram de execuções "
            "registradas; 'conversation' é só conversa anterior e não passou por revisão humana."
        )
        return "\n".join(lines)

    def get_tool_schemas(self) -> list[dict[str, Any]]:
        """Ferramentas que o provider entrega ao modelo."""
        return [
            {
                "name": "memory_search",
                "description": (
                    "Busca por significado na memória indexada do Genius Allspark. "
                    "Cada resultado traz a procedência: de qual resultado aprovado, fluxo de "
                    "aprendizado, documento de mind-clone ou conversa ele veio. Prefira "
                    "'approved-result' — passou por revisão humana."
                ),
                "parameters": {
                    "type": "object",
                    "properties": {
                        "query": {"type": "string", "description": "O que procurar, em linguagem natural."},
                        "k": {"type": "integer", "description": "Quantos resultados (padrão 5)."},
                        "source_types": {
                            "type": "array",
                            "items": {"type": "string", "enum": list(SOURCE_TYPES)},
                            "description": "Restringe a busca a certas procedências.",
                        },
                    },
                    "required": ["query"],
                },
            },
            {
                "name": "memory_index",
                "description": (
                    "Indexa um trecho na memória com procedência explícita. Use para registrar "
                    "o resultado de uma execução aprovada — nunca para guardar suposição."
                ),
                "parameters": {
                    "type": "object",
                    "properties": {
                        "text": {"type": "string", "description": "O conteúdo a lembrar."},
                        "source_type": {
                            "type": "string",
                            "enum": list(SOURCE_TYPES),
                            "description": "De onde este conhecimento vem.",
                        },
                        "source_id": {
                            "type": "string",
                            "description": "Identificador do run/aprovação/fluxo de origem.",
                        },
                        "chunk_id": {"type": "string", "description": "Id do trecho (opcional)."},
                    },
                    "required": ["text", "source_type", "source_id"],
                },
            },
        ]

    # ------------------------------------------------------------------ interno

    @property
    def store(self) -> MemoryStore:
        if self._store is None:
            self._store = MemoryStore(self._db_path)
        return self._store

    def close(self) -> None:
        if self._store is not None:
            self._store.close()
            self._store = None

    # ------------------------------------------------------- handlers das tools

    def handle_search(self, args: dict[str, Any], **kwargs: Any) -> str:
        try:
            query = args.get("query")
            if not isinstance(query, str) or not query.strip():
                raise ValueError("'query' é obrigatório")
            k = args.get("k", 5)
            if isinstance(k, bool) or not isinstance(k, int) or not 1 <= k <= 50:
                raise ValueError("'k' precisa ser inteiro entre 1 e 50")
            source_types = args.get("source_types")
            if source_types is not None:
                if not isinstance(source_types, list) or any(item not in SOURCE_TYPES for item in source_types):
                    raise ValueError(f"'source_types' precisa conter apenas {SOURCE_TYPES}")
            hits = self.store.search(query, k=k, source_types=source_types)
            return json.dumps(
                {"status": "ok", "results": [hit.to_dict() for hit in hits], "total": len(hits)},
                ensure_ascii=False,
            )
        except Exception as exc:  # noqa: BLE001 - contrato do Hermes
            return json.dumps({"status": "error", "error": str(exc), "kind": type(exc).__name__}, ensure_ascii=False)

    def handle_index(self, args: dict[str, Any], **kwargs: Any) -> str:
        try:
            text = args.get("text")
            source_type = args.get("source_type")
            source_id = args.get("source_id")
            if not isinstance(text, str) or not text.strip():
                raise ValueError("'text' é obrigatório")
            if not isinstance(source_id, str) or not source_id.strip():
                raise ValueError("'source_id' é obrigatório — memória sem procedência não entra")
            chunk_id = args.get("chunk_id")
            if not isinstance(chunk_id, str) or not chunk_id.strip():
                chunk_id = f"{source_type}:{source_id}:{self.store.count(str(source_type))}"
            record = self.store.index_chunk(
                chunk_id=chunk_id,
                text=text,
                source_type=str(source_type),
                source_id=source_id,
                session_id=self._session_id,
            )
            return json.dumps({"status": "indexed", **record}, ensure_ascii=False)
        except Exception as exc:  # noqa: BLE001 - contrato do Hermes
            return json.dumps({"status": "error", "error": str(exc), "kind": type(exc).__name__}, ensure_ascii=False)
