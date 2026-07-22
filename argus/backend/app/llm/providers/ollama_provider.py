"""Provedor local Ollama: /api/chat (format=json) e /api/embed (nomic-embed-text, 768d)."""
from __future__ import annotations

from typing import Any

import httpx
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from backend.app.core.config import get_settings
from backend.app.llm.base import LLMProvider, LLMProviderError
from backend.app.llm.schemas import LLMResult, LLMUsage

_RETRY = retry(
    retry=retry_if_exception_type((httpx.TransportError, httpx.HTTPStatusError)),
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, max=10),
    reraise=True,
)


class OllamaProvider(LLMProvider):
    name = "ollama"

    def __init__(
        self,
        base_url: str | None = None,
        chat_model: str = "llama3.1:8b",
        embed_model: str = "nomic-embed-text",
        timeout: float = 120.0,
    ) -> None:
        self.base_url = (base_url or get_settings().ollama_base_url).rstrip("/")
        self.chat_model = chat_model
        self.embed_model = embed_model
        self.timeout = timeout

    @_RETRY
    async def complete(self, prompt: str, json_schema: dict[str, Any] | None = None) -> LLMResult:
        body: dict[str, Any] = {
            "model": self.chat_model,
            "messages": [{"role": "user", "content": prompt}],
            "stream": False,
        }
        if json_schema is not None:
            body["format"] = "json"
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.post(f"{self.base_url}/api/chat", json=body)
            resp.raise_for_status()
        data = resp.json()
        content = data.get("message", {}).get("content")
        if not content:
            raise LLMProviderError("Ollama devolveu resposta vazia")
        return LLMResult(
            text=content,
            usage=LLMUsage(
                prompt_tokens=int(data.get("prompt_eval_count", 0)),
                completion_tokens=int(data.get("eval_count", 0)),
            ),
            provider=self.name,
            model=self.chat_model,
        )

    @_RETRY
    async def embed(self, text: str) -> list[float]:
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.post(
                f"{self.base_url}/api/embed",
                json={"model": self.embed_model, "input": text},
            )
            resp.raise_for_status()
        embeddings = resp.json().get("embeddings") or []
        if not embeddings or len(embeddings[0]) != 768:
            raise LLMProviderError("embedding ausente ou com dimensao != 768")
        return [float(x) for x in embeddings[0]]
