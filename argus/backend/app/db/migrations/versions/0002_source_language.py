"""Adiciona events.source_language (idioma original; o resumo e sempre pt-BR).

Revision ID: 0002
Revises: 0001
Create Date: 2026-07-22
"""
import sqlalchemy as sa
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("events", sa.Column("source_language", sa.String(8), nullable=True))


def downgrade() -> None:
    op.drop_column("events", "source_language")
