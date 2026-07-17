#!/usr/bin/env python3
"""Fail CI on common committed secret formats; supports explicit line allow markers."""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import re

PATTERNS = {
    "openai_like": re.compile(r"\bsk-[A-Za-z0-9_-]{20,}\b"),
    "github_token": re.compile(r"\b(?:ghp|github_pat)_[A-Za-z0-9_]{20,}\b"),
    "aws_access_key": re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
    "private_key": re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----"),
    "bearer_token": re.compile(r"\bBearer\s+[A-Za-z0-9._~+/-]{20,}=*\b", re.I),
}
TEXT_SUFFIXES = {".py", ".md", ".json", ".yaml", ".yml", ".toml", ".txt", ".html"}
SKIP_DIRS = {".git", ".venv", "dist", "build", "generated", "__pycache__", ".mypy_cache", ".pytest_cache"}


def scan(root: Path) -> list[dict[str, object]]:
    findings: list[dict[str, object]] = []
    for path in sorted(root.rglob("*")):
        if not path.is_file() or path.suffix.lower() not in TEXT_SUFFIXES or any(part in SKIP_DIRS for part in path.parts):
            continue
        try:
            lines = path.read_text(encoding="utf-8").splitlines()
        except UnicodeDecodeError:
            continue
        for line_number, line in enumerate(lines, 1):
            if "scan:allow" in line:
                continue
            for name, pattern in PATTERNS.items():
                if pattern.search(line):
                    findings.append({"file": str(path.relative_to(root)), "line": line_number, "pattern": name})
    return findings


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=Path("."))
    args = parser.parse_args()
    findings = scan(args.root.resolve())
    print(json.dumps({"status": "clean" if not findings else "blocked", "findings": findings}, indent=2))
    return 1 if findings else 0


if __name__ == "__main__":
    raise SystemExit(main())
