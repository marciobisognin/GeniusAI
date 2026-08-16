"""Descrições lidas pelo modelo."""
from __future__ import annotations

EXTRACT_PDF = {
    "name": "org_extract_pdf",
    "description": (
        "Extrai o organograma institucional de uma portaria em PDF, usando a "
        "tabela vetorial do documento (não texto por posição). Recupera linhas "
        "cortadas por quebra de página e códigos que somem da detecção de "
        "tabelas. Devolve as unidades com código, nome e hierarquia, prontas "
        "para as ferramentas org_* do servidor MCP genius-organograma."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "pdf_path": {"type": "string", "description": "Caminho do PDF da portaria."},
            "last_page": {
                "type": "integer",
                "description": "Página em que termina o artigo com a tabela de unidades (padrão: 18, valor da Portaria 876/2026-GRE).",
            },
        },
        "required": ["pdf_path"],
    },
}

EXTRACT_COMPETENCIAS = {
    "name": "org_extract_competencias",
    "description": (
        "Extrai as competências institucionais por artigo a partir do Anexo de "
        "uma portaria em PDF. Devolve, por artigo, a unidade, o resumo do "
        "primeiro inciso e quantos incisos existem — a base normativa que "
        "justifica o que cada unidade pode fazer."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "pdf_path": {"type": "string", "description": "Caminho do PDF da portaria."},
            "first_page": {
                "type": "integer",
                "description": "Primeira página do Anexo, 0-indexada (padrão: 17).",
            },
        },
        "required": ["pdf_path"],
    },
}
