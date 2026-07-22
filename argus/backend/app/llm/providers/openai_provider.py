"""OpenAI apenas para embedding de fallback: text-embedding-3-small com dimensions=768."""
from __future__ import annotations

from typing import Any

import httpx
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from backend.app.core.config import get_settings
from backend.app.llm.base import LLMProvider, LLMProviderError
from backend.app.llm.providers.openrouter_provider import (
    RetryableHTTPError,
    _raise_for_status_with_backoff,
)
from backend.app.llm.schemas import LLMResult


class OpenAIProvider(LLMProvider):
    name = "openai"
    BASE_URL = "https://api.openai.com/v1"
    EMBED_MODEL = "text-embedding-3-small"
    DIMENSIONS = 768  # obrigatorio: compatibilidade com a coluna VECTOR(768)

    def __init__(self, api_key: str | None = None, timeout: float = 30.0) -> None:
        self.api_key = api_key or get_settings().openai_api_key
        self.timeout = timeout

    async def complete(self, prompt: str, json_schema: dict[str, Any] | None = None) -> LLMResult:
        raise LLMProviderError("OpenAI e usado somente para embedding de fallback")

    @retry(
        retry=retry_if_exception_type((httpx.TransportError, RetryableHTTPError)),
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=2, max=30),
        reraise=True,
    )
    async def embed(self, text: str) -> list[float]:
        if not self.api_key:
            raise LLMProviderError("OPENAI_API_KEY ausente")
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.post(
                f"{self.BASE_URL}/embeddings",
                json={"model": self.EMBED_MODEL, "input": text, "dimensions": self.DIMENSIONS},
                headers={"Authorization": f"Bearer {self.api_key}"},
            )
            await _raise_for_status_with_backoff(resp)
        data = resp.json()
        vector = data["data"][0]["embedding"]
        if len(vector) != self.DIMENSIONS:
            raise LLMProviderError(f"dimensao inesperada: {len(vector)}")
        return [float(x) for x in vector]
