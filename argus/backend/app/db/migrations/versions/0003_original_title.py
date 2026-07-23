"""Adiciona events.original_title (titulo no idioma original; title passa a ser sempre pt-BR).

Revision ID: 0003
Revises: 0002
Create Date: 2026-07-22
"""
import sqlalchemy as sa
from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("events", sa.Column("original_title", sa.Text, nullable=True))


def downgrade() -> None:
    op.drop_column("events", "original_title")
