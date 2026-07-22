"""Provedor Anthropic (SDK oficial) — apenas chat, habilitado por perfil."""
from __future__ import annotations

from typing import Any

from tenacity import retry, stop_after_attempt, wait_exponential

from backend.app.core.config import get_settings
from backend.app.llm.base import LLMProvider, LLMProviderError
from backend.app.llm.schemas import LLMResult, LLMUsage


class AnthropicProvider(LLMProvider):
    name = "anthropic"

    def __init__(
        self,
        api_key: str | None = None,
        model: str = "claude-haiku-4-5-20251001",
        timeout: float = 60.0,
    ) -> None:
        self.api_key = api_key or get_settings().anthropic_api_key
        self.model = model
        self.timeout = timeout
        self._client: Any = None

    def _get_client(self) -> Any:
        if self._client is None:
            try:
                import anthropic
            except ImportError as exc:  # extra opcional [cloud]
                raise LLMProviderError("pacote 'anthropic' nao instalado") from exc
            self._client = anthropic.AsyncAnthropic(api_key=self.api_key, timeout=self.timeout)
        return self._client

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=2, max=30), reraise=True)
    async def complete(self, prompt: str, json_schema: dict[str, Any] | None = None) -> LLMResult:
        if not self.api_key:
            raise LLMProviderError("ANTHROPIC_API_KEY ausente")
        if json_schema is not None:
            prompt += "\n\nResponda SOMENTE com um objeto JSON valido, sem texto extra."
        message = await self._get_client().messages.create(
            model=self.model,
            max_tokens=1024,
            messages=[{"role": "user", "content": prompt}],
        )
        text = "".join(block.text for block in message.content if block.type == "text")
        return LLMResult(
            text=text,
            usage=LLMUsage(
                prompt_tokens=message.usage.input_tokens,
                completion_tokens=message.usage.output_tokens,
            ),
            provider=self.name,
            model=self.model,
        )

    async def embed(self, text: str) -> list[float]:
        raise LLMProviderError("Anthropic nao oferece embeddings; use Ollama/OpenAI")
