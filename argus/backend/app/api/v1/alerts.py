"""Alertas e metricas do pipeline/custo."""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Request
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.db.models import Alert, AuditLog
from backend.app.db.session import get_session
from backend.app.pipeline.stage1_filter import COUNTER_KEY

router = APIRouter()


@router.get("")
async def list_alerts(
    limit: int = 50, session: AsyncSession = Depends(get_session)
) -> list[dict[str, Any]]:
    result = await session.execute(
        select(Alert).order_by(Alert.triggered_at.desc()).limit(limit)
    )
    return [
        {
            "id": a.id, "event_id": a.event_id, "rule_name": a.rule_name,
            "severity": a.severity, "triggered_at": a.triggered_at.isoformat(),
            "channel": a.channel, "sent": a.sent,
        }
        for a in result.scalars().all()
    ]


@router.get("/metrics")
async def metrics(request: Request, session: AsyncSession = Depends(get_session)) -> dict[str, Any]:
    """Contadores do pipeline (Redis) + custo agregado (audit_logs)."""
    counters = await request.app.state.redis.hgetall(COUNTER_KEY)
    cost = await session.execute(
        select(
            func.coalesce(func.sum(AuditLog.cost_usd), 0.0),
            func.count(AuditLog.id),
            func.coalesce(func.sum(AuditLog.prompt_tokens + AuditLog.completion_tokens), 0),
        ).where(AuditLog.created_at >= func.date_trunc("day", func.now()))
    )
    cost_usd, calls, tokens = cost.one()
    return {
        "pipeline": {k: int(v) for k, v in counters.items()},
        "llm_today": {"cost_usd": float(cost_usd), "calls": int(calls), "tokens": int(tokens)},
    }
