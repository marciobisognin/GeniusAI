"""Schema inicial: extensoes postgis+vector, sources, events, alerts, audit_logs.

Revision ID: 0001
Revises:
Create Date: 2026-07-22
"""
import geoalchemy2
import pgvector.sqlalchemy
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    op.create_table(
        "sources",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String(200), nullable=False, unique=True),
        sa.Column("type", sa.String(20), nullable=False),
        sa.Column("url", sa.Text, nullable=False),
        sa.Column("language", sa.String(8), nullable=False, server_default="en"),
        sa.Column("active", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("last_checked", sa.DateTime(timezone=True)),
    )

    op.create_table(
        "events",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("title", sa.Text, nullable=False),
        sa.Column("summary", sa.Text),
        sa.Column("category", sa.String(30)),
        sa.Column("severity", sa.String(10)),
        sa.Column("confidence", sa.Float),
        sa.Column("is_inference", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("event_time", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
        sa.Column("ingested_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
        sa.Column("location",
                  geoalchemy2.Geometry(geometry_type="POINT", srid=4326, spatial_index=False)),
        sa.Column("geo_confidence", sa.Float),
        sa.Column("country", sa.String(80)),
        sa.Column("region", sa.String(120)),
        sa.Column("actors", JSONB),
        sa.Column("source_name", sa.String(200)),
        sa.Column("source_url", sa.Text),
        sa.Column("content_hash", sa.String(64), nullable=False, unique=True),
        sa.Column("raw_data", JSONB),
        sa.Column("embedding", pgvector.sqlalchemy.Vector(768)),
    )
    op.create_index("ix_events_event_time", "events", ["event_time"])
    op.create_index("ix_events_location", "events", ["location"], postgresql_using="gist")
    op.create_index(
        "ix_events_embedding_hnsw",
        "events",
        ["embedding"],
        postgresql_using="hnsw",
        postgresql_ops={"embedding": "vector_cosine_ops"},
    )

    op.create_table(
        "alerts",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("event_id", sa.Integer,
                  sa.ForeignKey("events.id", ondelete="CASCADE"), nullable=False),
        sa.Column("rule_name", sa.String(100), nullable=False),
        sa.Column("severity", sa.String(10), nullable=False),
        sa.Column("triggered_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
        sa.Column("channel", sa.String(30), nullable=False, server_default="api"),
        sa.Column("sent", sa.Boolean, nullable=False, server_default=sa.false()),
    )

    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("provider", sa.String(30), nullable=False),
        sa.Column("model", sa.String(120), nullable=False),
        sa.Column("task_type", sa.String(30), nullable=False),
        sa.Column("prompt_tokens", sa.Integer, nullable=False, server_default="0"),
        sa.Column("completion_tokens", sa.Integer, nullable=False, server_default="0"),
        sa.Column("cost_usd", sa.Float, nullable=False, server_default="0"),
        sa.Column("latency_ms", sa.Integer, nullable=False, server_default="0"),
        sa.Column("success", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
    )


def downgrade() -> None:
    op.drop_table("audit_logs")
    op.drop_table("alerts")
    op.drop_table("events")
    op.drop_table("sources")
