"""Embedding local por *hashing trick* — porte fiel de `src/embeddings.ts`.

Mesmo vetor, mesma dimensão, mesma normalização: um índice gerado pelo lado
TypeScript pode ser consultado pelo Python e vice-versa. `tests/test_parity.py`
compara as duas implementações contra uma fixture gerada pelo TypeScript — se
alguém mexer num lado só, o teste quebra.

Não é rede neural: é recuperação por similaridade de PLN clássico (mesma
família do Vowpal Wabbit). A vantagem é não depender de nenhuma API externa,
que é o que permite a memória funcionar sem provedor LLM configurado.
"""
from __future__ import annotations

import math
import re
import unicodedata

DIMENSIONS = 128

_TOKEN = re.compile(r"[a-z0-9]+")


def tokenize(text: str) -> list[str]:
    normalized = unicodedata.normalize("NFD", text)
    without_marks = "".join(char for char in normalized if not unicodedata.combining(char))
    return _TOKEN.findall(without_marks.lower())


def hash_token(token: str) -> int:
    # `(hash * 31 + charCode) >>> 0` do TypeScript: inteiro sem sinal de 32 bits.
    digest = 0
    for char in token:
        digest = (digest * 31 + ord(char)) & 0xFFFFFFFF
    return digest % DIMENSIONS


def embed_text(text: str) -> list[float]:
    vector = [0.0] * DIMENSIONS
    for token in tokenize(text):
        vector[hash_token(token)] += 1.0
    norm = math.sqrt(sum(value * value for value in vector)) or 1.0
    return [value / norm for value in vector]


def cosine(left: list[float], right: list[float]) -> float:
    """Vetores já vêm normalizados (L2), então o produto interno é o cosseno."""
    return sum(a * b for a, b in zip(left, right))
