"""GeoJSON para o mapa: FeatureCollection valido pronto para MapLibre."""
from __future__ import annotations

import datetime as dt
import json
from typing import Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.api.v1.events import apply_filters
from backend.app.db.models import Event
from backend.app.db.session import get_session

router = APIRouter()


@router.get("/geojson")
async def map_geojson(
    hours: int = Query(72, ge=1, le=24 * 30),
    category: str | None = None,
    severity: str | None = None,
    bbox: str | None = None,
    limit: int = Query(2000, ge=1, le=10000),
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    since = dt.datetime.now(dt.timezone.utc) - dt.timedelta(hours=hours)
    stmt = select(Event, func.ST_AsGeoJSON(Event.location)).where(Event.location.isnot(None))
    stmt = apply_filters(stmt, category, severity, since, None, bbox)
    stmt = stmt.order_by(Event.event_time.desc()).limit(limit)
    result = await session.execute(stmt)

    features = []
    for event, geometry_json in result.all():
        features.append(
            {
                "type": "Feature",
                "geometry": json.loads(geometry_json),
                "properties": {
                    "id": event.id,
                    "title": event.title,
                    "category": event.category,
                    "severity": event.severity,
                    "confidence": event.confidence,
                    "is_inference": event.is_inference,
                    "event_time": event.event_time.isoformat() if event.event_time else None,
                    "source_name": event.source_name,
                    "source_url": event.source_url,
                    "geo_confidence": event.geo_confidence,
                },
            }
        )
    return {"type": "FeatureCollection", "features": features}
