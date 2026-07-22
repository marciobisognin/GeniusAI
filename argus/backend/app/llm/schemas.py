"""Schemas Pydantic para saidas estruturadas da LLM (extra='forbid')."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

Category = Literal["conflito", "diplomacia", "naval", "aereo", "humanitario", "geofisico"]
Severity = Literal["low", "medium", "high", "critical"]


class LLMUsage(BaseModel):
    model_config = ConfigDict(extra="forbid")
    prompt_tokens: int = 0
    completion_tokens: int = 0


class LLMResult(BaseModel):
    model_config = ConfigDict(extra="forbid")
    text: str
    usage: LLMUsage = Field(default_factory=LLMUsage)
    provider: str = ""
    model: str = ""


class EventEnrichment(BaseModel):
    """Saida estruturada do Estagio 3."""
    model_config = ConfigDict(extra="forbid")

    summary: str = Field(
        description="Resumo objetivo SEMPRE em portugues do Brasil (traduzido do idioma original)."
    )
    category: Category
    severity: Severity
    confidence: float = Field(ge=0.0, le=1.0)
    is_inference: bool
    actors: list[str] = Field(default_factory=list)


class ExtractedEntities(BaseModel):
    model_config = ConfigDict(extra="forbid")
    people: list[str] = Field(default_factory=list)
    organizations: list[str] = Field(default_factory=list)
    locations: list[str] = Field(default_factory=list)
