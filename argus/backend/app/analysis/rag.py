"""RAG vetorial sobre pgvector com anti-alucinacao.

A LLM responde SOMENTE com base nos eventos recuperados, citando source_url;
sem cobertura suficiente, a resposta e "sem dados suficientes".
"""
from __future__ import annotations

import datetime as dt
import logging
from typing import Any

from backend.app.db.repositories.events_repo import EventsRepository
from backend.app.llm.router import LLMRouter

logger = logging.getLogger("argus.rag")

NO_DATA_ANSWER = "sem dados suficientes"

RAG_PROMPT = """Voce e um analista GEOINT. Responda a pergunta usando EXCLUSIVAMENTE
os eventos abaixo. Regras:
1. Cada afirmacao deve citar a fonte correspondente no formato [fonte: URL].
2. Se os eventos nao cobrirem a pergunta, responda exatamente: "{no_data}".
3. Nao use conhecimento externo; nao invente eventos, datas ou numeros.

EVENTOS RECUPERADOS:
{context}

PERGUNTA: {question}
"""


class RAGService:
    def __init__(self, repo: EventsRepository, router: LLMRouter | None = None) -> None:
        self.repo = repo
        self.router = router or LLMRouter()

    async def backfill_embeddings(self, batch_size: int = 50) -> int:
        """Gera embedding para eventos antigos sem vetor."""
        from sqlalchemy import select

        from backend.app.db.models import Event

        result = await self.repo.session.execute(
            select(Event).where(Event.embedding.is_(None)).limit(batch_size)
        )
        events = list(result.scalars().all())
        for event in events:
            event.embedding = await self.router.embed(
                f"{event.title}\n{event.summary or ''}"
            )
        await self.repo.session.commit()
        logger.info("backfill: %d embeddings gerados", len(events))
        return len(events)

    async def query_rag(
        self,
        question: str,
        limit: int = 5,
        distance_threshold: float = 0.45,
        bbox: tuple[float, float, float, float] | None = None,
        since_hours: int | None = None,
    ) -> dict[str, Any]:
        query_vector = await self.router.embed(question)
        since = (
            dt.datetime.now(dt.timezone.utc) - dt.timedelta(hours=since_hours)
            if since_hours else None
        )
        hits = await self.repo.search_similar_events(
            query_vector, limit=limit, distance_threshold=distance_threshold,
            bbox=bbox, since=since,
        )
        if not hits:
            return {"answer": NO_DATA_ANSWER, "sources": [], "events": []}

        context_lines = [
            f"- [{event.event_time}] {event.title} — {event.summary or ''}"
            f" (severidade: {event.severity}, categoria: {event.category},"
            f" fonte: {event.source_url or event.source_name})"
            for event, _distance in hits
        ]
        prompt = RAG_PROMPT.format(
            no_data=NO_DATA_ANSWER, context="\n".join(context_lines), question=question
        )
        result = await self.router.complete(prompt)
        return {
            "answer": result.text.strip(),
            "sources": [e.source_url for e, _ in hits if e.source_url],
            "events": [e.id for e, _ in hits],
        }
