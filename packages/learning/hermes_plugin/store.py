"""Índice vetorial local em SQLite — substitui o `vectra` do lado TypeScript.

Por que não replicar o formato do `vectra`: ele é um detalhe de implementação
do pacote Node, e o que precisa ser compatível entre os dois lados é o
**embedding** (garantido por `tests/test_parity.py`), não o arquivo de índice.
SQLite é biblioteca padrão do Python, então o provider não acrescenta nenhuma
dependência — o mesmo princípio do kernel do Foresight.

Busca por força bruta: são 128 dimensões e corpora de execuções aprovadas, não
bilhões de vetores. Índice aproximado aqui seria complexidade sem ganho.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
import json
from pathlib import Path
import sqlite3
from typing import Any, Iterable

from .embeddings import cosine, embed_text

SCHEMA_VERSION = 1

#: Procedência de um trecho de memória. `MemoryChunkSourceType` no canon
#: (`schemas/canon.schema.json`) é a fonte desta lista.
SOURCE_TYPES = ("run", "approval", "learning_flow", "skill", "conversation")


@dataclass(frozen=True)
class MemoryHit:
    id: str
    score: float
    text: str
    source_type: str
    source_id: str
    created_at: str
    session_id: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "score": round(self.score, 6),
            "text": self.text,
            "sourceType": self.source_type,
            "sourceId": self.source_id,
            "createdAt": self.created_at,
            "sessionId": self.session_id,
        }


class MemoryStore:
    """Armazena e recupera trechos de memória com procedência."""

    def __init__(self, path: str | Path) -> None:
        self.path = Path(path).expanduser()
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._connection = sqlite3.connect(str(self.path))
        self._connection.row_factory = sqlite3.Row
        self._migrate()

    def _migrate(self) -> None:
        self._connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS chunks (
                id TEXT PRIMARY KEY,
                text TEXT NOT NULL,
                source_type TEXT NOT NULL,
                source_id TEXT NOT NULL,
                created_at TEXT NOT NULL,
                session_id TEXT NOT NULL DEFAULT '',
                vector TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS chunks_source ON chunks (source_type, source_id);
            CREATE INDEX IF NOT EXISTS chunks_session ON chunks (session_id);
            """
        )
        self._connection.commit()

    def close(self) -> None:
        self._connection.close()

    def index_chunk(
        self,
        *,
        chunk_id: str,
        text: str,
        source_type: str,
        source_id: str,
        created_at: str | None = None,
        session_id: str = "",
    ) -> dict[str, Any]:
        if not isinstance(text, str) or not text.strip():
            raise ValueError("'text' não pode ser vazio")
        if source_type not in SOURCE_TYPES:
            raise ValueError(f"'source_type' deve ser um de {SOURCE_TYPES}, e não {source_type!r}")
        stamp = created_at or datetime.now(timezone.utc).isoformat()
        self._connection.execute(
            """
            INSERT INTO chunks (id, text, source_type, source_id, created_at, session_id, vector)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                text = excluded.text,
                source_type = excluded.source_type,
                source_id = excluded.source_id,
                created_at = excluded.created_at,
                session_id = excluded.session_id,
                vector = excluded.vector
            """,
            (chunk_id, text, source_type, source_id, stamp, session_id, json.dumps(embed_text(text))),
        )
        self._connection.commit()
        return {"id": chunk_id, "sourceType": source_type, "sourceId": source_id, "createdAt": stamp}

    def search(
        self,
        query: str,
        *,
        k: int = 5,
        source_types: Iterable[str] | None = None,
        session_id: str | None = None,
        min_score: float = 0.0,
    ) -> list[MemoryHit]:
        if not isinstance(query, str) or not query.strip():
            return []
        wanted = tuple(source_types) if source_types else None
        vector = embed_text(query)

        sql = "SELECT * FROM chunks"
        clauses: list[str] = []
        params: list[Any] = []
        if wanted:
            clauses.append(f"source_type IN ({','.join('?' for _ in wanted)})")
            params.extend(wanted)
        if session_id:
            clauses.append("session_id = ?")
            params.append(session_id)
        if clauses:
            sql += " WHERE " + " AND ".join(clauses)

        hits = [
            MemoryHit(
                id=row["id"],
                score=cosine(vector, json.loads(row["vector"])),
                text=row["text"],
                source_type=row["source_type"],
                source_id=row["source_id"],
                created_at=row["created_at"],
                session_id=row["session_id"],
            )
            for row in self._connection.execute(sql, params)
        ]
        # Empate resolvido pelo id, para a ordem ser determinística.
        hits.sort(key=lambda hit: (-hit.score, hit.id))
        return [hit for hit in hits if hit.score > min_score][: max(0, k)]

    def count(self, source_type: str | None = None) -> int:
        if source_type:
            cursor = self._connection.execute(
                "SELECT COUNT(*) FROM chunks WHERE source_type = ?", (source_type,)
            )
        else:
            cursor = self._connection.execute("SELECT COUNT(*) FROM chunks")
        return int(cursor.fetchone()[0])

    def stats(self) -> dict[str, int]:
        rows = self._connection.execute(
            "SELECT source_type, COUNT(*) AS total FROM chunks GROUP BY source_type"
        )
        return {row["source_type"]: int(row["total"]) for row in rows}
