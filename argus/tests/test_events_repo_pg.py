"""DoD 2.2 (integracao): requer Postgres com PostGIS+pgvector.

Roda apenas com ARGUS_PG_TESTS=1 (ex.: apos `docker compose up -d` e
`alembic upgrade head`). Sem o banco, e pulado — os demais testes cobrem a
logica com fakes.
"""
import os

import pytest

pytestmark = pytest.mark.skipif(
    os.environ.get("ARGUS_PG_TESTS") != "1",
    reason="requer Postgres real (ARGUS_PG_TESTS=1)",
)


async def test_create_and_query_by_radius_and_similarity():
    from backend.app.db.repositories.events_repo import EventsRepository
    from backend.app.db.session import get_session_factory

    async with get_session_factory()() as session:
        repo = EventsRepository(session)
        vector = [0.01] * 768
        event_id = await repo.create_event(
            title="Evento dummy Hormuz",
            summary="teste de integracao",
            content_hash="f" * 64,
            lat=26.6,
            lon=56.5,
            embedding=vector,
        )
        # segunda insercao com o mesmo hash → ON CONFLICT DO NOTHING
        assert await repo.create_event(title="dup", content_hash="f" * 64) is None

        nearby = await repo.find_events_by_radius(26.6, 56.5, radius_km=50)
        assert any(e.title == "Evento dummy Hormuz" for e in nearby)

        similar = await repo.search_similar_events(vector, limit=5, distance_threshold=0.5)
        assert any(e.id == event_id for e, _ in similar)
