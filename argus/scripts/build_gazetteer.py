#!/usr/bin/env python3
"""Constroi o gazetteer offline a partir do GeoNames (dominio publico, CC-BY).

Baixa `cities1000.zip` (cidades com 1000+ hab.) e um dump por pais/allCountries
filtrado pelas classes H (hidrografia: estreitos, golfos, canais) e T (relevo),
e grava tudo em `data/gazetteer/gazetteer.sqlite`.

Uso:
    python scripts/build_gazetteer.py            # cities1000 + feicoes H/T do arquivo 'no-country'
    python scripts/build_gazetteer.py --full     # inclui allCountries (grande: ~2 GB extraido)
"""
from __future__ import annotations

import argparse
import csv
import io
import sqlite3
import sys
import zipfile
from pathlib import Path

import httpx

BASE = "https://download.geonames.org/export/dump"
OUT_DIR = Path(__file__).resolve().parents[1] / "data" / "gazetteer"
DB_PATH = OUT_DIR / "gazetteer.sqlite"

# Colunas do dump GeoNames (tab-separated)
COL_NAME, COL_LAT, COL_LON, COL_FCLASS, COL_COUNTRY, COL_POP = 1, 4, 5, 6, 8, 14
KEEP_CLASSES = {"P", "H", "T"}


def download(name: str) -> bytes:
    url = f"{BASE}/{name}"
    print(f"baixando {url} ...")
    with httpx.Client(timeout=300.0, follow_redirects=True) as client:
        resp = client.get(url)
        resp.raise_for_status()
        return resp.content


def iter_rows(zip_bytes: bytes, inner_name: str):
    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
        with zf.open(inner_name) as fh:
            reader = csv.reader(io.TextIOWrapper(fh, encoding="utf-8"), delimiter="\t")
            for row in reader:
                if len(row) > COL_POP and row[COL_FCLASS] in KEEP_CLASSES:
                    yield (
                        row[COL_NAME],
                        float(row[COL_LAT]),
                        float(row[COL_LON]),
                        row[COL_COUNTRY],
                        row[COL_FCLASS],
                        int(row[COL_POP] or 0),
                    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--full", action="store_true", help="inclui allCountries (grande)")
    args = parser.parse_args()

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.execute("DROP TABLE IF EXISTS toponyms")
    conn.execute(
        "CREATE TABLE toponyms (name TEXT, lat REAL, lon REAL, country TEXT,"
        " feature_class TEXT, population INTEGER)"
    )
    conn.execute("CREATE INDEX ix_toponyms_name ON toponyms(name)")

    archives = [("cities1000.zip", "cities1000.txt"), ("no-country.zip", "null.txt")]
    if args.full:
        archives.append(("allCountries.zip", "allCountries.txt"))

    total = 0
    for zip_name, inner in archives:
        try:
            data = download(zip_name)
        except httpx.HTTPError as exc:
            print(f"aviso: {zip_name} indisponivel ({exc}); seguindo sem ele", file=sys.stderr)
            continue
        rows = list(iter_rows(data, inner))
        conn.executemany("INSERT INTO toponyms VALUES (?,?,?,?,?,?)", rows)
        conn.commit()
        total += len(rows)
        print(f"{zip_name}: {len(rows)} toponimos")

    conn.close()
    print(f"ok: {total} toponimos em {DB_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
