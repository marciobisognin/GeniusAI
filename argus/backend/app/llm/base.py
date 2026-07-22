"""Interface abstrata dos provedores de LLM."""
from __future__ import annotations

import abc
import json
from typing import Any, TypeVar

from pydantic import BaseModel, ValidationError

from backend.app.llm.schemas import ExtractedEntities, LLMResult

T = TypeVar("T", bound=BaseModel)


class LLMProviderError(RuntimeError):
    """Falha permanente de um provedor (esgotou retries/reparo)."""


class LLMProvider(abc.ABC):
    name: str = "base"

    @abc.abstractmethod
    async def complete(
        self, prompt: str, json_schema: dict[str, Any] | None = None
    ) -> LLMResult: ...

    @abc.abstractmethod
    async def embed(self, text: str) -> list[float]: ...

    async def summarize(self, text: str) -> LLMResult:
        prompt = (
            "Resuma o texto a seguir em ate 3 frases objetivas, sem opiniao, "
            "mantendo nomes proprios e numeros:\n\n" + text
        )
        return await self.complete(prompt)

    async def extract_entities(self, text: str) -> ExtractedEntities:
        schema = ExtractedEntities.model_json_schema()
        prompt = (
            "Extraia entidades do texto. Responda SOMENTE com JSON no formato "
            '{"people": [], "organizations": [], "locations": []}.\n\nTexto:\n' + text
        )
        result = await self.complete(prompt, json_schema=schema)
        return parse_structured(result.text, ExtractedEntities)


def parse_structured(raw: str, model_cls: type[T]) -> T:
    """Valida JSON contra o schema; uma tentativa de reparo antes de erro."""
    try:
        return model_cls.model_validate_json(raw)
    except ValidationError:
        repaired = _repair_json(raw)
        try:
            return model_cls.model_validate(repaired)
        except ValidationError as exc:
            raise LLMProviderError(f"JSON invalido apos reparo: {exc}") from exc


def _repair_json(raw: str) -> Any:
    """Reparo simples: extrai o primeiro objeto JSON do texto (remove cercas/prosa)."""
    start = raw.find("{")
    end = raw.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise LLMProviderError("resposta sem objeto JSON")
    try:
        return json.loads(raw[start : end + 1])
    except json.JSONDecodeError as exc:
        raise LLMProviderError(f"JSON irrecuperavel: {exc}") from exc
