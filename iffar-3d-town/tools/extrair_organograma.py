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

A extração por tabela por si só não é suficiente: uma linha cujo conteúdo é
cortado ao meio pela quebra de página pode sobreviver como fragmento (ver
`recover_split_row`) ou desaparecer inteira de `find_tables()` sem deixar
nenhum resquício (ver `recover_missing_code` — foi o caso de `1.6.2` e
`1.2.5.4.1`, encontrados só depois de comparar a contagem de unidades por
seção com uma varredura bruta de códigos no texto). Por isso o script varre
o documento inteiro em busca de qualquer código que não tenha sido
capturado por nenhuma tabela (`scan_all_codes`) e tenta reconstruir essas
linhas — mas o "tentar" importa: confira o aviso "[aviso] código '...'
ausente de todas as tabelas" no stderr sempre que a extração rodar, e
confirme manualmente contra o PDF qualquer unidade reconstruída dessa
forma, além das seções 1.1 (Reitoria), 1.9 (Frederico Westphalen) e 1.13
(São Luiz Gonzaga). Divergência em qualquer código, nome ou função deve ser
corrigida neste script, nunca no YAML gerado.
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


def scan_all_codes(pdf, last_page: int):
    """Varre todas as páginas em busca de QUALQUER token de código (coluna
    UNIDADE), independente da extração por tabela — usado só para validar
    que nenhuma unidade foi perdida (`find_tables()` pode derrubar uma linha
    inteira quando ela é cortada ao meio pela quebra de página, sem deixar
    nem um fragmento; ver `1.2.5.4.1`, Campus Alegrete)."""
    found = []
    for page_idx, page in enumerate(pdf.pages[:last_page]):
        for w in page.extract_words(use_text_flow=False, keep_blank_chars=False):
            if w["x0"] < 130 and 20 < w["top"] < 810 and CODE_RE.match(w["text"]):
                found.append((page_idx, w["top"], w["text"].rstrip(".")))
    found.sort(key=lambda t: (t[0], t[1]))
    return found


def recover_missing_code(pdf, all_codes, missing_index: int, next_known_nome: str | None):
    """Reconstrói uma linha cujo código nem chegou a aparecer em nenhuma
    tabela extraída (diferente de `recover_split_row`, que trata o caso mais
    comum de um fragmento sobrevivente).

    O código da linha perdida aparece no início do conteúdo da própria
    linha nos casos observados, então a janela vai da posição do próprio
    código até a posição do PRÓXIMO código conhecido (podendo atravessar a
    quebra de página). Mas o INVERSO nem sempre vale: o próximo código pode
    estar no meio do nome dele (como qualquer linha normal), o que vazaria
    o começo do próximo nome para dentro deste. Por isso, se o nome da
    próxima unidade já foi capturado corretamente pela extração por tabela
    (`next_known_nome`), qualquer palavra final que bata com o começo desse
    nome é removida da reconstrução.
    """
    page_idx, top, code = all_codes[missing_index]
    v_here = page_idx * 1000.0 + top
    v_next = (
        all_codes[missing_index + 1][0] * 1000.0 + all_codes[missing_index + 1][1]
        if missing_index + 1 < len(all_codes)
        else v_here + 2000
    )

    words = []
    for p_idx in range(page_idx, min(page_idx + 3, len(pdf.pages))):
        for w in pdf.pages[p_idx].extract_words(use_text_flow=False, keep_blank_chars=False):
            if 20 < w["top"] < 810:
                v = p_idx * 1000.0 + w["top"]
                if v_here <= v < v_next:
                    words.append((v, w["x0"], w["text"]))
    words.sort(key=lambda t: (t[0], t[1]))

    nome_words = [t for _, x0, t in words if x0 < X_NOME_MAX and t.rstrip(".") != code]
    tail_words = [t for _, x0, t in words if x0 >= X_NOME_MAX]

    if next_known_nome:
        next_words = next_known_nome.upper().split()
        for k in range(min(len(next_words), len(nome_words)), 0, -1):
            if nome_words[-k:] == next_words[:k]:
                nome_words = nome_words[:-k]
                break

    nome = re.sub(r"\s+", " ", " ".join(nome_words)).strip() or None
    cargo, funcao = (tail_words[0], tail_words[1]) if len(tail_words) >= 2 else (None, None)
    return [code, nome, cargo, funcao]


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

        # gate de validação: nenhum código que aparece no PDF pode ficar de
        # fora — diferente do fragmento tratado acima, uma linha cortada ao
        # meio pela quebra de página às vezes some inteira de find_tables(),
        # sem deixar nem um resquício (ver 1.2.5.4.1, Campus Alegrete).
        all_codes = scan_all_codes(pdf, last_page)
        nome_by_code = {
            r[0].rstrip("."): r[1] for r in rows if r[0] and CODE_RE.match(r[0]) and r[1]
        }
        captured = {r[0].rstrip(".") for r in rows if r[0] and CODE_RE.match(r[0])}
        for i, (_, _, code) in enumerate(all_codes):
            if code in captured:
                continue
            next_code = all_codes[i + 1][2] if i + 1 < len(all_codes) else None
            recovered = recover_missing_code(
                pdf, all_codes, i, nome_by_code.get(next_code) if next_code else None
            )
            print(
                f"[aviso] código '{code}' ausente de todas as tabelas extraídas "
                "(provável quebra de página); recuperado por posição bruta",
                file=sys.stderr,
            )
            rows.append(recovered)
            captured.add(code)
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
