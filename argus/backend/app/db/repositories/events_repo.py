"""Repositorio de eventos: insercao idempotente, busca espacial e vetorial."""
from __future__ import annotations

import datetime as dt
from typing import Any

from sqlalchemy import Select, func, select, text
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.db.models import Event


class EventsRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create_event(self, **fields: Any) -> int | None:
        """Insere com `ON CONFLICT (content_hash) DO NOTHING`. Retorna id ou None se duplicado."""
        lat = fields.pop("lat", None)
        lon = fields.pop("lon", None)
        if lat is not None and lon is not None:
            fields["location"] = func.ST_SetSRID(func.ST_MakePoint(lon, lat), 4326)
        stmt = (
            pg_insert(Event)
            .values(**fields)
            .on_conflict_do_nothing(index_elements=[Event.content_hash])
            .returning(Event.id)
        )
        result = await self.session.execute(stmt)
        await self.session.commit()
        return result.scalar_one_or_none()

    async def find_events_by_radius(
        self, lat: float, lon: float, radius_km: float, limit: int = 100
    ) -> list[Event]:
        """ST_DWithin sobre geography — raio em metros correto no globo."""
        point = func.ST_SetSRID(func.ST_MakePoint(lon, lat), 4326)
        stmt = (
            select(Event)
            .where(Event.location.isnot(None))
            .where(
                func.ST_DWithin(
                    func.cast(Event.location, text("geography")),
                    func.cast(point, text("geography")),
                    radius_km * 1000.0,
                )
            )
            .order_by(Event.event_time.desc())
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def search_similar_events(
        self,
        query_vector: list[float],
        limit: int = 5,
        distance_threshold: float = 0.3,
        bbox: tuple[float, float, float, float] | None = None,
        since: dt.datetime | None = None,
    ) -> list[tuple[Event, float]]:
        """Top-N por distancia cosseno (`<=>`), com filtro espacial/temporal opcional."""
        distance = Event.embedding.cosine_distance(query_vector).label("distance")
        stmt: Select[Any] = (
            select(Event, distance)
            .where(Event.embedding.isnot(None))
            .where(distance <= distance_threshold)
        )
        if bbox is not None:
            min_lon, min_lat, max_lon, max_lat = bbox
            stmt = stmt.where(
                func.ST_Intersects(
                    Event.location, func.ST_MakeEnvelope(min_lon, min_lat, max_lon, max_lat, 4326)
                )
            )
        if since is not None:
            stmt = stmt.where(Event.event_time >= since)
        stmt = stmt.order_by(distance).limit(limit)
        result = await self.session.execute(stmt)
        return [(row[0], float(row[1])) for row in result.all()]

    async def list_recent(
        self, limit: int = 50, category: str | None = None
    ) -> list[Event]:
        stmt = select(Event).order_by(Event.event_time.desc()).limit(limit)
        if category:
            stmt = stmt.where(Event.category == category)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def count_recent_similar_sources(
        self, content_vector: list[float], hours: int = 24, distance: float = 0.2
    ) -> int:
        """Numero de fontes independentes com evento semanticamente proximo (corroboracao)."""
        since = dt.datetime.now(dt.timezone.utc) - dt.timedelta(hours=hours)
        dist = Event.embedding.cosine_distance(content_vector)
        stmt = (
            select(func.count(func.distinct(Event.source_name)))
            .where(Event.embedding.isnot(None))
            .where(Event.event_time >= since)
            .where(dist <= distance)
        )
        result = await self.session.execute(stmt)
        return int(result.scalar_one() or 0)
