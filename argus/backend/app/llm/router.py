"""Router hibrido de LLM: perfis LOCAL_ONLY | HYBRID | CLOUD_PREFERRED com fallback e auditoria."""
from __future__ import annotations

import time
from typing import Any

from backend.app.core.config import LLMProfile, get_settings, load_yaml_config
from backend.app.llm.base import LLMProvider, LLMProviderError
from backend.app.llm.schemas import LLMResult

PROFILE_REDIS_KEY = "argus:llm_profile"

# Ordem de fallback por perfil (chat). Em LOCAL_ONLY nada sai para a nuvem.
_CHAT_CHAINS: dict[LLMProfile, list[str]] = {
    LLMProfile.LOCAL_ONLY: ["ollama"],
    LLMProfile.HYBRID: ["ollama", "openrouter", "anthropic"],
    LLMProfile.CLOUD_PREFERRED: ["openrouter", "anthropic", "ollama"],
}
_EMBED_CHAINS: dict[LLMProfile, list[str]] = {
    LLMProfile.LOCAL_ONLY: ["ollama"],
    LLMProfile.HYBRID: ["ollama", "openai"],
    LLMProfile.CLOUD_PREFERRED: ["openai", "ollama"],
}


class AllProvidersFailedError(LLMProviderError):
    """Todos os provedores permitidos pelo perfil falharam — item volta para a fila."""


def _load_prices() -> dict[str, dict[str, float]]:
    models = load_yaml_config("models").get("models", {})
    return {
        key.split("/", 1)[1]: {
            "input": float(cfg.get("input_per_mtok", 0.0)),
            "output": float(cfg.get("output_per_mtok", 0.0)),
        }
        for key, cfg in models.items()
    }


class LLMRouter:
    def __init__(
        self,
        providers: dict[str, LLMProvider] | None = None,
        profile: LLMProfile | None = None,
        audit_sink: Any = None,
    ) -> None:
        """`providers` injetavel para teste; `audit_sink` e um callable async que grava AuditLog."""
        self.profile = profile or get_settings().llm_profile
        self.audit_sink = audit_sink
        self.prices = _load_prices()
        if providers is not None:
            self.providers = providers
        else:
            from backend.app.llm.providers.anthropic_provider import AnthropicProvider
            from backend.app.llm.providers.ollama_provider import OllamaProvider
            from backend.app.llm.providers.openai_provider import OpenAIProvider
            from backend.app.llm.providers.openrouter_provider import OpenRouterProvider

            self.providers = {
                "ollama": OllamaProvider(),
                "openrouter": OpenRouterProvider(),
                "anthropic": AnthropicProvider(),
                "openai": OpenAIProvider(),
            }

    def set_profile(self, profile: LLMProfile) -> None:
        """Troca de perfil em runtime (persistencia no Redis fica na API)."""
        self.profile = profile

    def _cost_usd(self, model: str, prompt_tokens: int, completion_tokens: int) -> float:
        price = self.prices.get(model, {"input": 0.0, "output": 0.0})
        return (
            prompt_tokens * price["input"] + completion_tokens * price["output"]
        ) / 1_000_000.0

    async def _audit(
        self,
        provider: str,
        model: str,
        task_type: str,
        result: LLMResult | None,
        latency_ms: int,
        success: bool,
    ) -> None:
        if self.audit_sink is None:
            return
        usage = result.usage if result else None
        await self.audit_sink(
            provider=provider,
            model=model,
            task_type=task_type,
            prompt_tokens=usage.prompt_tokens if usage else 0,
            completion_tokens=usage.completion_tokens if usage else 0,
            cost_usd=self._cost_usd(
                model, usage.prompt_tokens if usage else 0, usage.completion_tokens if usage else 0
            ),
            latency_ms=latency_ms,
            success=success,
        )

    async def complete(self, prompt: str, json_schema: dict[str, Any] | None = None) -> LLMResult:
        return await self._run_chain(
            _CHAT_CHAINS[self.profile], "complete", prompt=prompt, json_schema=json_schema
        )

    async def embed(self, text: str) -> list[float]:
        errors: list[str] = []
        for name in _EMBED_CHAINS[self.profile]:
            provider = self.providers.get(name)
            if provider is None:
                continue
            start = time.monotonic()
            try:
                vector = await provider.embed(text)
                await self._audit(name, getattr(provider, "embed_model", "embedding"),
                                  "embed", None, int((time.monotonic() - start) * 1000), True)
                return vector
            except Exception as exc:
                await self._audit(name, getattr(provider, "embed_model", "embedding"),
                                  "embed", None, int((time.monotonic() - start) * 1000), False)
                errors.append(f"{name}: {exc}")
        raise AllProvidersFailedError("; ".join(errors))

    async def _run_chain(self, chain: list[str], task_type: str, **kwargs: Any) -> LLMResult:
        errors: list[str] = []
        for name in chain:
            provider = self.providers.get(name)
            if provider is None:
                continue
            start = time.monotonic()
            try:
                result: LLMResult = await provider.complete(**kwargs)
                await self._audit(name, result.model, task_type, result,
                                  int((time.monotonic() - start) * 1000), True)
                return result
            except Exception as exc:
                await self._audit(name, getattr(provider, "chat_model", getattr(provider, "model", "?")),
                                  task_type, None, int((time.monotonic() - start) * 1000), False)
                errors.append(f"{name}: {exc}")
        raise AllProvidersFailedError("; ".join(errors))


async def db_audit_sink(**fields: Any) -> None:
    """Sink padrao: grava em audit_logs."""
    from backend.app.db.models import AuditLog
    from backend.app.db.session import get_session_factory

    async with get_session_factory()() as session:
        session.add(AuditLog(**fields))
        await session.commit()
