"""Perfil de LLM em runtime, persistido no Redis."""
from __future__ import annotations

from fastapi import APIRouter, Request
from pydantic import BaseModel

from backend.app.core.config import LLMProfile, get_settings
from backend.app.llm.router import PROFILE_REDIS_KEY

router = APIRouter()


class ProfileBody(BaseModel):
    profile: LLMProfile


@router.get("/profile")
async def get_profile(request: Request) -> dict[str, str]:
    stored = await request.app.state.redis.get(PROFILE_REDIS_KEY)
    return {"profile": stored or get_settings().llm_profile.value}


@router.put("/profile")
async def set_profile(body: ProfileBody, request: Request) -> dict[str, str]:
    await request.app.state.redis.set(PROFILE_REDIS_KEY, body.profile.value)
    return {"profile": body.profile.value}
