#!/usr/bin/env python3
"""Copia os extratores de `tools/` para dentro do plug-in.

Por que a cópia existe: o Hermes instala um plug-in copiando **o diretório do
plug-in** para `~/.hermes/plugins/<nome>/`. O diretório irmão `tools/` não vai
junto — então um plug-in que dependesse de `../tools` carregaria normalmente e
falharia em toda extração fora de um checkout do repositório.

A fonte de verdade continua sendo `tools/*.py` (usados também como CLI, como o
README do projeto documenta). Esta cópia é derivada, e
`test_plugin.py::test_vendored_extractors_are_in_sync` falha se as duas
versões divergirem.

Uso:
    python3 hermes_plugin/sync_extractors.py            # copia
    python3 hermes_plugin/sync_extractors.py --check    # só verifica
"""
from __future__ import annotations

from pathlib import Path
import sys

PLUGIN_DIR = Path(__file__).resolve().parent
SOURCE_DIR = PLUGIN_DIR.parent / "tools"
VENDOR_DIR = PLUGIN_DIR / "extractors"

MODULES = ("extrair_organograma.py", "extrair_competencias.py")

HEADER = (
    "# Gerado por hermes_plugin/sync_extractors.py a partir de tools/ — não editar à mão.\n"
    "# Editar o original em tools/ e rodar o sync.\n"
)


def render(module: str) -> str:
    return HEADER + (SOURCE_DIR / module).read_text(encoding="utf-8")


def check() -> list[str]:
    stale = []
    for module in MODULES:
        target = VENDOR_DIR / module
        if not target.is_file() or target.read_text(encoding="utf-8") != render(module):
            stale.append(module)
    return stale


def sync() -> None:
    VENDOR_DIR.mkdir(parents=True, exist_ok=True)
    (VENDOR_DIR / "__init__.py").write_text(
        '"""Cópia dos extratores de `tools/`, para o plug-in funcionar instalado."""\n',
        encoding="utf-8",
    )
    for module in MODULES:
        (VENDOR_DIR / module).write_text(render(module), encoding="utf-8")


def main(argv: list[str]) -> int:
    if "--check" in argv:
        stale = check()
        if stale:
            print(f"extratores defasados: {', '.join(stale)}", file=sys.stderr)
            print("rode: python3 hermes_plugin/sync_extractors.py", file=sys.stderr)
            return 1
        print(f"extratores em dia ({len(MODULES)})")
        return 0
    sync()
    print(f"{len(MODULES)} extratores copiados para {VENDOR_DIR}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
