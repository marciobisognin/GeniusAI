"""Executable safety, redaction and untrusted-text controls."""
from __future__ import annotations

from html import escape
import re
from typing import Iterable

BLOCKED_OPERATIONAL_PATTERNS: tuple[tuple[str, re.Pattern[str]], ...] = (
    ("targeting", re.compile(r"\b(target(?:ing)?|selecionar alvos?|coordenadas?)\b.{0,80}\b(militar|ataque|míssil|drone|infraestrutura crítica)\b", re.I | re.S)),
    ("sabotage", re.compile(r"\b(sabotag(?:e|em)|explosiv[oa]s?|incendiar|destruir)\b.{0,100}\b(como|passo|plano|método|instruç)", re.I | re.S)),
    ("tactical_planning", re.compile(r"\b(plano|planejamento|rota|tática)\b.{0,80}\b(ataque|invasão|emboscada|targeting|operação militar)\b", re.I | re.S)),
    ("sanctions_evasion", re.compile(r"\b(evitar|burlar|contornar|evadir)\b.{0,80}\b(sanções|embargo|controle de exportação)\b", re.I | re.S)),
    ("vulnerable_infrastructure", re.compile(r"\b(vulnerabilidade|ponto fraco)\b.{0,80}\b(rede elétrica|usina|hospital|abastecimento de água|infraestrutura crítica)\b.{0,80}\b(explorar|atacar|interromper)", re.I | re.S)),
)

SECRET_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(r"\bsk-[A-Za-z0-9_-]{20,}\b"),
    re.compile(r"\b(?:ghp|github_pat)_[A-Za-z0-9_]{20,}\b"),
    re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
    re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----"),
    re.compile(r"\bBearer\s+[A-Za-z0-9._~+/-]{20,}=*\b", re.I),
)
EMAIL_PATTERN = re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.I)
PHONE_PATTERN = re.compile(r"(?<![\w-])(?:\+\d{1,3}[ .-]?)?(?:\(\d{2,3}\)[ .-]?)?\d{4,5}[ .-]\d{4}(?!\d)")
ACTIVE_SCHEME_PATTERN = re.compile(r"\b(?:javascript|data|vbscript):", re.I)


def assess_problem(problem: str) -> dict[str, object]:
    findings = [name for name, pattern in BLOCKED_OPERATIONAL_PATTERNS if pattern.search(problem)]
    return {
        "allowed": not findings,
        "findings": findings,
        "policy": "aggregate_defensive_analysis_only",
        "action": "continue" if not findings else "abstain_and_request_benign_reframing",
    }


def enforce_problem_policy(problem: str) -> None:
    findings = [name for name, pattern in BLOCKED_OPERATIONAL_PATTERNS if pattern.search(problem)]
    if findings:
        raise ValueError(f"briefing bloqueado pela política de uso: {', '.join(findings)}")


def redact_sensitive(text: str) -> str:
    redacted = text
    for pattern in SECRET_PATTERNS:
        redacted = pattern.sub("[SEGREDO REDIGIDO]", redacted)
    redacted = EMAIL_PATTERN.sub("[EMAIL REDIGIDO]", redacted)
    redacted = PHONE_PATTERN.sub("[TELEFONE REDIGIDO]", redacted)
    redacted = ACTIVE_SCHEME_PATTERN.sub("[ESQUEMA REDIGIDO]", redacted)
    return redacted


def safe_markdown_text(value: object) -> str:
    """Render untrusted content as inert Markdown text.

    HTML is entity-escaped and Markdown link/control punctuation is escaped so
    input cannot become an active tag, link or table cell in permissive renderers.
    """
    text = redact_sensitive(str(value))
    text = escape(text, quote=True)
    for char in ("\\", "`", "*", "_", "{", "}", "[", "]", "(", ")", "#", "+", "-", "!", "|", ">"):
        text = text.replace(char, "\\" + char)
    return text


def redact_mapping_strings(items: Iterable[str]) -> tuple[str, ...]:
    return tuple(redact_sensitive(str(item)) for item in items)
