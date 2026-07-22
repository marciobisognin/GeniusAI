"""Modelos ORM: fontes, eventos (espacial + vetorial), alertas e auditoria de LLM."""
from __future__ import annotations

import datetime as dt
from typing import Any

from geoalchemy2 import Geometry
from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

EMBEDDING_DIMS = 768


def utcnow() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


class Base(DeclarativeBase):
    pass


class Source(Base):
    __tablename__ = "sources"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(200), unique=True)
    type: Mapped[str] = mapped_column(String(20))  # rss|gdelt|ucdp|reliefweb|gdacs|usgs|firms|adsb|ais|mastodon
    url: Mapped[str] = mapped_column(Text)
    language: Mapped[str] = mapped_column(String(8), default="en")
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_checked: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True))


class Event(Base):
    __tablename__ = "events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(Text)
    summary: Mapped[str | None] = mapped_column(Text)
    category: Mapped[str | None] = mapped_column(String(30))  # conflito|diplomacia|naval|aereo|humanitario|geofisico
    severity: Mapped[str | None] = mapped_column(String(10))  # low|medium|high|critical
    confidence: Mapped[float | None] = mapped_column(Float)
    is_inference: Mapped[bool] = mapped_column(Boolean, default=False)
    event_time: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    ingested_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    location: Mapped[Any | None] = mapped_column(Geometry(geometry_type="POINT", srid=4326))
    geo_confidence: Mapped[float | None] = mapped_column(Float)
    country: Mapped[str | None] = mapped_column(String(80))
    region: Mapped[str | None] = mapped_column(String(120))
    actors: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    source_name: Mapped[str | None] = mapped_column(String(200))
    source_url: Mapped[str | None] = mapped_column(Text)
    content_hash: Mapped[str] = mapped_column(String(64), unique=True)
    raw_data: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    embedding: Mapped[list[float] | None] = mapped_column(Vector(EMBEDDING_DIMS))

    __table_args__ = (
        Index("ix_events_event_time", "event_time"),
        Index("ix_events_location", "location", postgresql_using="gist"),
        Index(
            "ix_events_embedding_hnsw",
            "embedding",
            postgresql_using="hnsw",
            postgresql_ops={"embedding": "vector_cosine_ops"},
        ),
    )


class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("events.id", ondelete="CASCADE"))
    rule_name: Mapped[str] = mapped_column(String(100))
    severity: Mapped[str] = mapped_column(String(10))
    triggered_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    channel: Mapped[str] = mapped_column(String(30), default="api")
    sent: Mapped[bool] = mapped_column(Boolean, default=False)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    provider: Mapped[str] = mapped_column(String(30))
    model: Mapped[str] = mapped_column(String(120))
    task_type: Mapped[str] = mapped_column(String(30))  # complete|summarize|extract|embed
    prompt_tokens: Mapped[int] = mapped_column(Integer, default=0)
    completion_tokens: Mapped[int] = mapped_column(Integer, default=0)
    cost_usd: Mapped[float] = mapped_column(Float, default=0.0)
    latency_ms: Mapped[int] = mapped_column(Integer, default=0)
    success: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
