#!/usr/bin/env python3
"""Extrai businesses/iffar/org-chart.yaml a partir do PDF da Portaria Eletrônica do IFFar.

Uso:
    python3 extrair_organograma.py portaria876.pdf > ../businesses/iffar/org-chart.yaml

Método: o PDF da portaria contém uma tabela vetorial real (bordas desenhadas,
não apenas texto alinhado por espaços), então usamos a detecção de tabelas do
pdfplumber (`page.find_tables()` + `Table.extract()`). Isso resolve com
exatidão a quebra de nomes de unidade em múltiplas linhas dentro de uma
célula — o problema que inviabiliza o parsing por posição de texto puro
(`pdftotext -layout`) ou por proximidade vertical de palavras.

Gate de qualidade obrigatório antes de usar o YAML gerado: conferir manualmente
as seções 1.1 (Reitoria), 1.9 (Campus Frederico Westphalen) e 1.13 (Campus São
Luiz Gonzaga) contra o PDF. Divergência em qualquer código, nome ou função deve
ser corrigida neste script, nunca no YAML gerado.
"""

import re
import sys
import unicodedata
from datetime import date

import pdfplumber
import yaml

CODE_RE = re.compile(r"^1(\.\d+)+\.?$")
TOP_LEVEL_RE = re.compile(r"^1\.(\d+)$")

LOWERS = {"de", "da", "do", "das", "dos", "e", "a", "o", "em", "com", "para"}
KEEP_UPPER = {"pdi", "ppc", "ead", "cd", "fg", "fcc", "n/a", "pnee"}


def slugify(text: str) -> str:
    t = unicodedata.normalize("NFD", text)
    t = "".join(c for c in t if unicodedata.category(c) != "Mn")
    t = re.sub(r"[^a-zA-Z0-9]+", "-", t.lower()).strip("-")
    return t


def _capitalize_segment(w: str) -> str:
    core = w.strip("(),")
    if core.lower() in KEEP_UPPER:
        return w
    if not w.isupper():
        return w
    return "-".join(part.capitalize() for part in w.split("-"))


def titlecase_pt(text: str) -> str:
    """Converte NOME EM CAIXA ALTA para Título, preservando siglas/conectores."""
    words = text.split()
    out = []
    for i, w in enumerate(words):
        core = w.strip("(),")
        if core.lower() in KEEP_UPPER:
            out.append(w)
        elif w.lower() in LOWERS and i != 0:
            out.append(w.lower())
        else:
            out.append(_capitalize_segment(w))
    return " ".join(out)


def clean_cell(cell):
    if cell is None:
        return None
    # "-\n" é hifenização de quebra de linha (ex.: "PÓS-\nGRADUAÇÃO"), não um
    # separador de palavras — junta sem espaço; as demais quebras viram espaço.
    cell = cell.replace("-\n", "-").replace("\n", " ")
    return re.sub(r"\s+", " ", cell).strip()


X_NOME_MAX = 320


def recover_split_row(page, after_top: float):
    """Recupera uma linha cujo código+nome ficou fora da grade detectada por
    `find_tables()` porque a quebra de página corta a linha da tabela no
    meio (visto em '1.6.2' — Gabinete do Diretor Geral do Campus Panambi: o
    código+nome ficaram fora de qualquer célula, e só o cargo/função foi
    capturado como uma linha solta '[None, None, cargo, funcao]' no fim da
    página). Reconstrói pela posição bruta das palavras dessa mesma página,
    na faixa entre a última linha confirmada e o rodapé."""
    words = [
        w
        for w in page.extract_words(use_text_flow=False, keep_blank_chars=False)
        if after_top < w["top"] < 810
    ]
    code_word = next(
        (w for w in words if w["x0"] < 130 and CODE_RE.match(w["text"])), None
    )
    if code_word is None:
        return None
    nome_words = [
        w["text"]
        for w in sorted(words, key=lambda w: (w["top"], w["x0"]))
        if w["x0"] < X_NOME_MAX and w is not code_word
    ]
    nome = re.sub(r"\s+", " ", " ".join(nome_words)).strip()
    return code_word["text"].rstrip("."), nome or None


def extract_rows(pdf_path: str, last_page: int):
    """Percorre as tabelas do PDF e devolve linhas normalizadas
    (code, nome, cargo, funcao), ignorando cabeçalhos de seção/tabela."""
    rows = []
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages[:last_page]:
            page_rows = []
            for table in page.find_tables():
                for raw_row in table.extract():
                    cells = [clean_cell(c) for c in raw_row]
                    code, nome, cargo, funcao = (cells + [None] * 4)[:4]
                    if code == "UNIDADE":
                        continue  # cabeçalho de coluna repetido por página
                    if code and not CODE_RE.match(code):
                        # linha de seção, ex.: "1.2 CAMPUS ALEGRETE"
                        m = re.match(r"^(1(?:\.\d+)+)\s+(.+)$", code)
                        if m:
                            page_rows.append([m.group(1), m.group(2), None, None])
                        continue
                    page_rows.append([code, nome, cargo, funcao])

            # linha de continuação no FIM da página == fragmento de uma linha
            # cujo código+nome não entraram em nenhuma célula detectada,
            # porque a quebra de página cortou a linha da tabela ao meio.
            last = page_rows[-1] if page_rows else None
            if last and last[0] is None and last[1] is None and (last[2] or last[3]):
                prev_code = next(
                    (r[0] for r in reversed(page_rows[:-1]) if r[0] and CODE_RE.match(r[0])),
                    None,
                )
                prev_top = -1.0
                if prev_code:
                    match = next(
                        (
                            w
                            for w in page.extract_words(use_text_flow=False)
                            if w["x0"] < 130 and w["text"].rstrip(".") == prev_code
                        ),
                        None,
                    )
                    if match:
                        prev_top = match["top"]
                recovered = recover_split_row(page, after_top=prev_top)
                if recovered:
                    code, nome = recovered
                    print(
                        f"[aviso] linha '{code}' cortada pela quebra de página; "
                        "código+nome recuperados por posição bruta",
                        file=sys.stderr,
                    )
                    last[0], last[1] = code, nome

            rows.extend(page_rows)
    return rows


def build_records(rows):
    """Agrega linhas de continuação (sem código, papel adicional) na unidade
    anterior e monta o registro final por unidade."""
    records = []
    seen_ids: dict[str, int] = {}
    pending_extra_role = None

    for code, nome, cargo, funcao in rows:
        if code is None:
            # linha de continuação: segundo papel da unidade anterior (ex.:
            # "CHEFE FG-0001" abaixo de "DIRETOR(A) GERAL CD-0002"). O papel
            # principal já foi capturado; ignoramos o secundário no modelo.
            continue

        raw = code.rstrip(".")
        if raw in seen_ids:
            seen_ids[raw] += 1
            uid = f"{raw}#{seen_ids[raw]}"
            print(
                f"[aviso] código duplicado na portaria: {raw} ('{nome}') -> tratado como {uid}",
                file=sys.stderr,
            )
        else:
            seen_ids[raw] = 1
            uid = raw

        records.append(
            {
                "raw_id": raw,
                "id": uid,
                "nome": titlecase_pt(nome) if nome else nome,
                "cargo": cargo,
                "funcao": funcao.replace(" ", "") if funcao else funcao,
            }
        )
    return records


def build_tree(records):
    units = []
    by_raw_id: dict[str, str] = {}
    for r in records:
        by_raw_id.setdefault(r["raw_id"], r["id"])

    for r in records:
        raw = r["raw_id"]
        if TOP_LEVEL_RE.match(raw):
            parent = "1.1" if raw != "1.1" else None
        else:
            # a portaria tem ao menos uma lacuna real de numeração (falta
            # "1.8.3" no Campus São Borja); nesses casos, sobe na cadeia até
            # achar o ancestral mais próximo que realmente existe.
            segments = raw.split(".")
            parent = None
            for cut in range(len(segments) - 1, 0, -1):
                candidate = ".".join(segments[:cut])
                if candidate in by_raw_id:
                    parent = by_raw_id[candidate]
                    break
            if parent is None:
                print(
                    f"[aviso] pai não encontrado para {raw} ('{r['nome']}'); anexado à Reitoria",
                    file=sys.stderr,
                )
                parent = "1.1"
            elif parent != by_raw_id.get(raw.rsplit(".", 1)[0]):
                print(
                    f"[aviso] lacuna de numeração na portaria: {raw} ('{r['nome']}') "
                    f"não tem pai direto '{raw.rsplit('.', 1)[0]}'; anexado a {parent}",
                    file=sys.stderr,
                )

        slug_base = r["nome"] or raw
        unit = {
            "id": r["id"],
            "slug": slugify(f"{raw}-{slug_base}"),
            "nome": r["nome"],
            "parent": parent,
        }
        if r["cargo"] and r["cargo"] != "-":
            unit["cargo"] = r["cargo"]
        if r["funcao"] and r["funcao"] not in ("-", "N/A"):
            unit["funcao"] = r["funcao"]
        units.append(unit)
    return units


def main():
    if len(sys.argv) < 2:
        print(f"uso: {sys.argv[0]} <portaria.pdf> [ultima_pagina_art1]", file=sys.stderr)
        sys.exit(1)

    pdf_path = sys.argv[1]
    last_page = int(sys.argv[2]) if len(sys.argv) > 2 else 18

    rows = extract_rows(pdf_path, last_page)
    records = build_records(rows)
    units = build_tree(records)

    doc = {
        "meta": {
            "fonte": "Portaria Eletrônica nº 876/2026 - GRE",
            "data": str(date(2026, 7, 3)),
            "revoga": "Portaria Eletrônica nº 398/2026",
            "processo": "23873.000543/2026-09",
            "extraido_em": str(date.today()),
            "gerado_por": "tools/extrair_organograma.py (não editar à mão)",
        },
        "units": units,
    }

    yaml.dump(
        doc,
        sys.stdout,
        allow_unicode=True,
        sort_keys=False,
        default_flow_style=False,
        width=100,
    )
    print(f"[info] {len(units)} unidades extraídas.", file=sys.stderr)


if __name__ == "__main__":
    main()
