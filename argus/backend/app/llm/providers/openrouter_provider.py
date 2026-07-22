"""OpenRouter (API OpenAI-compatible) com modelos gratuitos como fallback."""
from __future__ import annotations

import asyncio
from typing import Any

import httpx
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from backend.app.core.config import get_settings
from backend.app.llm.base import LLMProvider, LLMProviderError
from backend.app.llm.schemas import LLMResult, LLMUsage


class RetryableHTTPError(RuntimeError):
    pass


_RETRY = retry(
    retry=retry_if_exception_type((httpx.TransportError, RetryableHTTPError)),
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=2, max=30),
    reraise=True,
)


async def _raise_for_status_with_backoff(resp: httpx.Response) -> None:
    """429 respeita Retry-After; 5xx vira erro re-tentavel; 4xx e permanente."""
    if resp.status_code == 429:
        retry_after = float(resp.headers.get("Retry-After", "2"))
        await asyncio.sleep(min(retry_after, 30.0))
        raise RetryableHTTPError("429 Too Many Requests")
    if resp.status_code >= 500:
        raise RetryableHTTPError(f"{resp.status_code} server error")
    resp.raise_for_status()


class OpenRouterProvider(LLMProvider):
    name = "openrouter"
    BASE_URL = "https://openrouter.ai/api/v1"

    def __init__(
        self,
        api_key: str | None = None,
        model: str = "meta-llama/llama-3.1-8b-instruct:free",
        timeout: float = 60.0,
    ) -> None:
        self.api_key = api_key or get_settings().openrouter_api_key
        self.model = model
        self.timeout = timeout

    @_RETRY
    async def complete(self, prompt: str, json_schema: dict[str, Any] | None = None) -> LLMResult:
        if not self.api_key:
            raise LLMProviderError("OPENROUTER_API_KEY ausente")
        body: dict[str, Any] = {
            "model": self.model,
            "messages": [{"role": "user", "content": prompt}],
        }
        if json_schema is not None:
            body["response_format"] = {"type": "json_object"}
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.post(
                f"{self.BASE_URL}/chat/completions",
                json=body,
                headers={"Authorization": f"Bearer {self.api_key}"},
            )
            await _raise_for_status_with_backoff(resp)
        data = resp.json()
        try:
            content = data["choices"][0]["message"]["content"]
        except (KeyError, IndexError) as exc:
            raise LLMProviderError(f"resposta inesperada do OpenRouter: {exc}") from exc
        usage = data.get("usage", {})
        return LLMResult(
            text=content,
            usage=LLMUsage(
                prompt_tokens=int(usage.get("prompt_tokens", 0)),
                completion_tokens=int(usage.get("completion_tokens", 0)),
            ),
            provider=self.name,
            model=self.model,
        )

    async def embed(self, text: str) -> list[float]:
        raise LLMProviderError("OpenRouter nao e usado para embeddings neste sistema")
