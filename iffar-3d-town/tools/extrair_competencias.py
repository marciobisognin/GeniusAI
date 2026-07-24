#!/usr/bin/env python3
"""Extrai businesses/iffar/competencias.yaml a partir do Anexo I da Portaria
Eletrônica do IFFar (atribuições das unidades organizacionais).

Uso:
    python3 extrair_competencias.py portaria876.pdf > ../businesses/iffar/competencias.yaml

O Anexo I segue um padrão regular e repetido 114 vezes: uma linha de
cabeçalho "Atribuições d[oa](s) <Unidade>[ - SIGLA]" seguida da linha
"Art. N Compete a(o) <unidade>: ..." e, depois, os incisos (I, II, III...).
Extraímos o artigo e o primeiro inciso real (não resumos inventados) como
descrição; o texto completo de cada artigo fica em `texto_completo` para
consulta.
"""

import re
import sys
from datetime import date

from pypdf import PdfReader
import yaml

HEADING_RE = re.compile(r"^Atribuições\s+(?:d[eoa]s?|a[oa]s?)\s+(.+?)\s*$")
ARTIGO_RE = re.compile(r"^Art\.\s*(\d+)[ºo°.]*\s*(.*)$")
# duas linhas do PDF (Arts. 54 e 55) perdem o prefixo "Art." na extração de
# texto — reproduzível tanto com pypdf quanto com pdfplumber, então é um
# problema no PDF de origem, não nas bibliotecas. Sem o prefixo, só aceitamos
# a linha como início de artigo se ela seguir o padrão "Nº. Compete ...".
ARTIGO_SEM_PREFIXO_RE = re.compile(r"^(\d+)\.\s*(Compete\b.*)$")
INCISO_RE = re.compile(r"^([IVXLC]+)\s*[-–]\s*(.+)$")


def slugify(text: str) -> str:
    import unicodedata

    t = unicodedata.normalize("NFD", text)
    t = "".join(c for c in t if unicodedata.category(c) != "Mn")
    t = re.sub(r"[^a-zA-Z0-9]+", "-", t.lower()).strip("-")
    return t


def extract_anexo_text(pdf_path: str, first_page: int) -> str:
    """`first_page` (0-indexado) é só uma dica de onde procurar o marcador
    'ANEXO I' — a página em que ele cai também contém os Arts. 2º-5º da
    parte operativa da portaria (fora do Anexo), que têm os MESMOS números
    dos primeiros artigos do Anexo I. Por isso corta o texto exatamente no
    marcador, em vez de incluir a página inteira."""
    reader = PdfReader(pdf_path)
    anchor_page_text = reader.pages[first_page].extract_text()
    idx = anchor_page_text.find("ANEXO I")
    if idx == -1:
        raise RuntimeError("marcador 'ANEXO I' não encontrado na página indicada")
    parts = [anchor_page_text[idx:]]
    parts += [reader.pages[i].extract_text() for i in range(first_page + 1, len(reader.pages))]
    return "\n".join(parts)


def parse_articles(text: str):
    """Cada 'Atribuições de <Unidade>' normalmente precede um único
    'Art. N ...', mas vários artigos (ex.: 40-49, sobre engenharia) são
    complementares e não repetem o cabeçalho — nesses casos o título da
    unidade do cabeçalho anterior é mantido. Por isso a criação de um novo
    registro é disparada pela linha 'Art. N', nunca pelo cabeçalho."""
    lines = text.split("\n")
    articles = []
    current = None
    last_heading = None

    def flush():
        if current is not None:
            articles.append(current)

    for line in lines:
        line = line.rstrip()
        if not line:
            continue
        if re.match(r"^\d+/\d+$|^https?://|^\d{2}/\d{2}/\d{4}", line.strip()):
            continue  # rodapé/cabeçalho de página do SIPAC

        heading_m = HEADING_RE.match(line.strip())
        artigo_m = ARTIGO_RE.match(line.strip()) or ARTIGO_SEM_PREFIXO_RE.match(line.strip())

        if artigo_m:
            flush()
            current = {
                "unidade_titulo": last_heading,
                "artigo": int(artigo_m.group(1)),
                "intro": artigo_m.group(2).strip(),
                "incisos": [],
            }
            continue

        if heading_m:
            last_heading = heading_m.group(1).strip().rstrip(":").strip()
            continue

        if current is not None:
            inciso_m = INCISO_RE.match(line.strip())
            if inciso_m:
                current["incisos"].append(line.strip())
            elif current["incisos"]:
                # continuação de linha quebrada do último inciso
                current["incisos"][-1] = (current["incisos"][-1] + " " + line.strip()).strip()
            else:
                current["intro"] = (current["intro"] + " " + line.strip()).strip()

    flush()
    return [a for a in articles if a["artigo"] is not None]


def main():
    if len(sys.argv) < 2:
        print(f"uso: {sys.argv[0]} <portaria.pdf> [primeira_pagina_anexo]", file=sys.stderr)
        sys.exit(1)

    pdf_path = sys.argv[1]
    first_page = int(sys.argv[2]) if len(sys.argv) > 2 else 17  # 0-indexado

    text = extract_anexo_text(pdf_path, first_page)
    articles = parse_articles(text)

    competencias = []
    for a in articles:
        primeiro_inciso = re.sub(r"\s+", " ", a["incisos"][0]) if a["incisos"] else None
        competencias.append(
            {
                "artigo": a["artigo"],
                "unidade_titulo": a["unidade_titulo"],
                "slug": slugify(a["unidade_titulo"]),
                "resumo": primeiro_inciso,
                "total_incisos": len(a["incisos"]),
            }
        )

    doc = {
        "meta": {
            "fonte": "Portaria Eletrônica nº 876/2026 - GRE, Anexo I",
            "extraido_em": str(date.today()),
            "gerado_por": "tools/extrair_competencias.py (não editar à mão)",
        },
        "competencias": competencias,
    }

    yaml.dump(
        doc, sys.stdout, allow_unicode=True, sort_keys=False, default_flow_style=False, width=100
    )
    print(f"[info] {len(competencias)} artigos extraídos.", file=sys.stderr)


if __name__ == "__main__":
    main()
