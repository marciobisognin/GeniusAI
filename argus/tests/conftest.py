"""Fakes compartilhados: Redis em memoria e provedores de LLM."""
from __future__ import annotations

import fnmatch
import time
from typing import Any

import pytest

from backend.app.llm.base import LLMProvider, LLMProviderError
from backend.app.llm.schemas import LLMResult, LLMUsage


class FakeRedis:
    """Subconjunto de comandos usado pelo sistema (strings, hashes, TTL)."""

    def __init__(self) -> None:
        self.store: dict[str, Any] = {}
        self.hashes: dict[str, dict[str, str]] = {}
        self.expiries: dict[str, float] = {}
        self.streams: dict[str, list[tuple[str, dict[str, str]]]] = {}

    def _expired(self, key: str) -> bool:
        expiry = self.expiries.get(key)
        if expiry is not None and time.monotonic() >= expiry:
            self.store.pop(key, None)
            self.expiries.pop(key, None)
            return True
        return False

    async def set(self, key: str, value: str, nx: bool = False, ex: int | None = None) -> bool | None:
        self._expired(key)
        if nx and key in self.store:
            return None
        self.store[key] = value
        if ex is not None:
            self.expiries[key] = time.monotonic() + ex
        return True

    async def get(self, key: str) -> str | None:
        self._expired(key)
        return self.store.get(key)

    async def delete(self, key: str) -> int:
        return 1 if self.store.pop(key, None) is not None else 0

    async def hincrby(self, key: str, field: str, amount: int = 1) -> int:
        h = self.hashes.setdefault(key, {})
        h[field] = str(int(h.get(field, "0")) + amount)
        return int(h[field])

    async def hset(self, key: str, field: str, value: str) -> int:
        self.hashes.setdefault(key, {})[field] = value
        return 1

    async def hget(self, key: str, field: str) -> str | None:
        return self.hashes.get(key, {}).get(field)

    async def hgetall(self, key: str) -> dict[str, str]:
        return dict(self.hashes.get(key, {}))

    async def expire(self, key: str, seconds: int) -> bool:
        return True

    async def xadd(self, stream: str, fields: dict[str, str], maxlen: int | None = None,
                   approximate: bool = True) -> str:
        entries = self.streams.setdefault(stream, [])
        message_id = f"{len(entries) + 1}-0"
        entries.append((message_id, dict(fields)))
        return message_id

    async def keys(self, pattern: str = "*") -> list[str]:
        return [k for k in self.store if fnmatch.fnmatch(k, pattern)]


class ScriptedProvider(LLMProvider):
    """Provedor de teste: devolve respostas roteirizadas ou falha de proposito."""

    def __init__(self, name: str, response: str = "{}", fail: bool = False,
                 embedding: list[float] | None = None) -> None:
        self.name = name
        self.response = response
        self.fail = fail
        self.embedding = embedding or [0.1] * 768
        self.complete_calls = 0
        self.embed_calls = 0

    async def complete(self, prompt: str, json_schema: dict[str, Any] | None = None) -> LLMResult:
        self.complete_calls += 1
        if self.fail:
            raise LLMProviderError(f"{self.name} indisponivel (teste)")
        return LLMResult(text=self.response, usage=LLMUsage(prompt_tokens=10, completion_tokens=5),
                         provider=self.name, model=f"{self.name}-model")

    async def embed(self, text: str) -> list[float]:
        self.embed_calls += 1
        if self.fail:
            raise LLMProviderError(f"{self.name} indisponivel (teste)")
        return self.embedding


@pytest.fixture
def fake_redis() -> FakeRedis:
    return FakeRedis()
