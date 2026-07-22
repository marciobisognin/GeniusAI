"""Eventos: paginacao + filtros (categoria, severidade, intervalo, bbox)."""
from __future__ import annotations

import datetime as dt
from typing import Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.db.models import Event
from backend.app.db.session import get_session

router = APIRouter()


def event_to_dict(event: Event, lat: float | None = None, lon: float | None = None) -> dict[str, Any]:
    return {
        "id": event.id,
        "title": event.title,
        "summary": event.summary,
        "category": event.category,
        "severity": event.severity,
        "confidence": event.confidence,
        "is_inference": event.is_inference,
        "event_time": event.event_time.isoformat() if event.event_time else None,
        "geo_confidence": event.geo_confidence,
        "country": event.country,
        "region": event.region,
        "actors": event.actors,
        "source_name": event.source_name,
        "source_url": event.source_url,
        "lat": lat,
        "lon": lon,
    }


def apply_filters(
    stmt: Any,
    category: str | None,
    severity: str | None,
    start: dt.datetime | None,
    end: dt.datetime | None,
    bbox: str | None,
) -> Any:
    if category:
        stmt = stmt.where(Event.category == category)
    if severity:
        stmt = stmt.where(Event.severity == severity)
    if start:
        stmt = stmt.where(Event.event_time >= start)
    if end:
        stmt = stmt.where(Event.event_time <= end)
    if bbox:
        min_lon, min_lat, max_lon, max_lat = (float(x) for x in bbox.split(","))
        stmt = stmt.where(
            func.ST_Intersects(
                Event.location, func.ST_MakeEnvelope(min_lon, min_lat, max_lon, max_lat, 4326)
            )
        )
    return stmt


@router.get("")
async def list_events(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    category: str | None = None,
    severity: str | None = None,
    start: dt.datetime | None = None,
    end: dt.datetime | None = None,
    bbox: str | None = Query(None, description="min_lon,min_lat,max_lon,max_lat"),
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    stmt = apply_filters(select(Event), category, severity, start, end, bbox)
    stmt = stmt.order_by(Event.event_time.desc()).offset((page - 1) * page_size).limit(page_size)
    lat = func.ST_Y(Event.location).label("lat")
    lon = func.ST_X(Event.location).label("lon")
    stmt = stmt.add_columns(lat, lon)
    result = await session.execute(stmt)
    rows = result.all()
    return {
        "page": page,
        "page_size": page_size,
        "items": [event_to_dict(row[0], row[1], row[2]) for row in rows],
    }
