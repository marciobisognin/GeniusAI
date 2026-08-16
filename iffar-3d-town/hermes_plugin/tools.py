"""Handlers do plug-in de extração normativa.

Mesmo contrato do plug-in do Foresight, e pelas mesmas razões: todo handler
devolve **string JSON** (inclusive no erro), nunca levanta exceção, e aceita
`**kwargs`.

Os extratores vivem em `../tools/` como scripts de linha de comando. Aqui eles
são importados por caminho e chamados como funções — nada de `subprocess`, que
só acrescentaria uma fronteira de processo e perderia a exceção original.

As dependências pesadas (`pdfplumber`, `pypdf`, `PyYAML`) são importadas dentro
dos handlers: o plug-in precisa carregar — e `hermes plugins doctor` precisa
passar — mesmo antes de elas serem instaladas.
"""
from __future__ import annotations

from datetime import date
import functools
import importlib.util
import json
from pathlib import Path
import re
import sys
from typing import Any, Callable

TOOLS_DIR = Path(__file__).resolve().parent.parent / "tools"

#: Página em que termina o Art. 1º na Portaria nº 876/2026-GRE (a fonte para a
#: qual os extratores foram depurados). Outro documento provavelmente precisa
#: de outro valor — por isso é parâmetro, não constante escondida.
DEFAULT_LAST_PAGE = 18
DEFAULT_ANEXO_PAGE = 17


def _dumps(payload: Any) -> str:
    return json.dumps(payload, ensure_ascii=False, default=str)


def _handler(func: Callable[..., Any]) -> Callable[..., str]:
    """Serializa o retorno e transforma qualquer falha no envelope de erro."""

    @functools.wraps(func)
    def wrapper(args: dict[str, Any] | None = None, **kwargs: Any) -> str:
        try:
            return _dumps(func(args or {}, **kwargs))
        except Exception as exc:  # noqa: BLE001 - contrato do Hermes: nunca propagar
            return _dumps({"status": "error", "error": str(exc), "kind": type(exc).__name__})

    return wrapper


def _load_extractor(module_name: str):
    """Importa um dos scripts de `tools/` como módulo."""
    path = TOOLS_DIR / f"{module_name}.py"
    if not path.is_file():
        raise FileNotFoundError(f"extrator não encontrado: {path}")
    cached = sys.modules.get(f"_genius_{module_name}")
    if cached is not None:
        return cached
    spec = importlib.util.spec_from_file_location(f"_genius_{module_name}", path)
    if spec is None or spec.loader is None:
        raise ImportError(f"não foi possível carregar {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[f"_genius_{module_name}"] = module
    spec.loader.exec_module(module)
    return module


def _pdf_path(args: dict[str, Any]) -> Path:
    raw = args.get("pdf_path")
    if not isinstance(raw, str) or not raw.strip():
        raise ValueError("'pdf_path' é obrigatório e precisa ser um caminho não vazio")
    path = Path(raw).expanduser()
    if path.is_symlink() or not path.is_file():
        raise ValueError(f"'pdf_path' precisa apontar para um arquivo regular: {path}")
    if path.suffix.lower() != ".pdf":
        raise ValueError("'pdf_path' precisa ser um .pdf")
    return path


def _page(args: dict[str, Any], key: str, default: int) -> int:
    value = args.get(key, default)
    if isinstance(value, bool) or not isinstance(value, int):
        raise ValueError(f"'{key}' precisa ser inteiro")
    if not 0 <= value <= 10_000:
        raise ValueError(f"'{key}' fora do intervalo aceitável")
    return value


@_handler
def extract_pdf(args: dict[str, Any], **kwargs: Any) -> dict[str, Any]:
    """Organograma a partir da tabela vetorial do PDF."""
    path = _pdf_path(args)
    last_page = _page(args, "last_page", DEFAULT_LAST_PAGE)
    extractor = _load_extractor("extrair_organograma")

    rows = extractor.extract_rows(str(path), last_page)
    records = extractor.build_records(rows)
    units = extractor.build_tree(records)

    return {
        "status": "extracted",
        "source": path.name,
        "extracted_at": str(date.today()),
        "units": units,
        "count": len(units),
        "hint": (
            "cada unidade traz código, nome e hierarquia. Passe esta lista ao "
            "servidor MCP `genius-organograma` (ferramentas org_*) para decidir "
            "cobertura, agentes e squads."
        ),
    }


@_handler
def extract_competencias(args: dict[str, Any], **kwargs: Any) -> dict[str, Any]:
    """Competências por artigo, a partir do Anexo I da portaria."""
    path = _pdf_path(args)
    first_page = _page(args, "first_page", DEFAULT_ANEXO_PAGE)
    extractor = _load_extractor("extrair_competencias")

    text = extractor.extract_anexo_text(str(path), first_page)
    articles = extractor.parse_articles(text)

    competencias = [
        {
            "artigo": article["artigo"],
            "unidade_titulo": article["unidade_titulo"],
            "slug": extractor.slugify(article["unidade_titulo"]),
            "resumo": re.sub(r"\s+", " ", article["incisos"][0]) if article["incisos"] else None,
            "total_incisos": len(article["incisos"]),
        }
        for article in articles
    ]

    return {
        "status": "extracted",
        "source": path.name,
        "extracted_at": str(date.today()),
        "competencias": competencias,
        "count": len(competencias),
    }
