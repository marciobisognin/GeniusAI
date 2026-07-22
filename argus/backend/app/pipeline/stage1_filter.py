"""Estagio 1: dedup por SHA-256 + filtro de palavras-chave por idioma.

Determinismo barato antes de qualquer LLM: e este estagio que torna o custo
viavel em alto volume. Contadores de descarte ficam no Redis.
"""
from __future__ import annotations

import hashlib
import re
import string
import unicodedata
from pathlib import Path

import redis.asyncio as aioredis

KEYWORDS_DIR = Path(__file__).resolve().parents[3] / "keywords"
DEDUP_TTL_SECONDS = 24 * 3600
COUNTER_KEY = "argus:counters"  # hash: passed / dropped_duplicate / dropped_no_keyword

_PUNCT_TABLE = str.maketrans("", "", string.punctuation)


def normalize_text(text: str) -> str:
    """lowercase + sem pontuacao + espacos colapsados (base do hash de dedup)."""
    text = unicodedata.normalize("NFKC", text).lower().translate(_PUNCT_TABLE)
    return re.sub(r"\s+", " ", text).strip()


def content_hash(text: str) -> str:
    return hashlib.sha256(normalize_text(text).encode("utf-8")).hexdigest()


def _load_keywords(language: str) -> re.Pattern[str]:
    path = KEYWORDS_DIR / f"{language}.txt"
    if not path.exists():
        path = KEYWORDS_DIR / "en.txt"
    words = [w.strip() for w in path.read_text(encoding="utf-8").splitlines() if w.strip()]
    escaped = sorted((re.escape(w) for w in words), key=len, reverse=True)
    return re.compile(r"(?<!\w)(?:" + "|".join(escaped) + r")(?!\w)", re.IGNORECASE)


class Stage1Filter:
    def __init__(self, redis: aioredis.Redis) -> None:
        self.redis = redis
        self._patterns: dict[str, re.Pattern[str]] = {}  # compilado uma vez por idioma

    def _pattern(self, language: str) -> re.Pattern[str]:
        if language not in self._patterns:
            self._patterns[language] = _load_keywords(language)
        return self._patterns[language]

    async def process(self, item: dict) -> dict | None:
        """Retorna o item enriquecido com content_hash, ou None se descartado."""
        text = " ".join(filter(None, [item.get("title", ""), item.get("summary", "")]))
        if not text.strip():
            await self.redis.hincrby(COUNTER_KEY, "dropped_empty", 1)
            return None

        digest = content_hash(text)
        # SETNX com TTL: primeiro a chegar ganha; repeticoes em 24h sao duplicatas.
        is_new = await self.redis.set(f"argus:dedup:{digest}", "1", nx=True, ex=DEDUP_TTL_SECONDS)
        if not is_new:
            await self.redis.hincrby(COUNTER_KEY, "dropped_duplicate", 1)
            return None

        language = (item.get("language") or "en").lower()[:2]
        # Fontes ja qualificadas (ex.: USGS, GDACS) podem pular o filtro de keywords.
        if not item.get("pre_qualified") and not self._pattern(language).search(text):
            await self.redis.hincrby(COUNTER_KEY, "dropped_no_keyword", 1)
            return None

        await self.redis.hincrby(COUNTER_KEY, "passed", 1)
        return {**item, "content_hash": digest, "language": language}
