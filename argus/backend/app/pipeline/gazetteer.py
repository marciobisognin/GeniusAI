"""Gazetteer GeoNames offline (cities1000 + feicoes fisicas/hidrograficas H e T).

Formato em disco: SQLite gerado por `scripts/build_gazetteer.py`. Sem o arquivo
completo, cai no seed embutido no repositorio (principais cidades, estreitos,
golfos e canais) — suficiente para testes e degradacao graciosa.
"""
from __future__ import annotations

import csv
import sqlite3
import unicodedata
from dataclasses import dataclass
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parents[3] / "data" / "gazetteer"
DB_PATH = DATA_DIR / "gazetteer.sqlite"
SEED_PATH = DATA_DIR / "seed.tsv"


def _fold(name: str) -> str:
    """Normaliza para busca: minusculas e sem acentos."""
    nfkd = unicodedata.normalize("NFKD", name.lower().strip())
    return "".join(c for c in nfkd if not unicodedata.combining(c))


@dataclass(frozen=True)
class Toponym:
    name: str
    lat: float
    lon: float
    country: str
    feature_class: str  # P = cidade, H = hidrografia, T = relevo
    population: int

    @property
    def relevance(self) -> int:
        # Feicoes fisicas nao tem populacao; damos peso fixo alto para que
        # "Strait of Hormuz" ganhe de homonimos obscuros.
        return self.population if self.feature_class == "P" else 5_000_000


class Gazetteer:
    def __init__(self, db_path: Path | None = None, seed_path: Path | None = None) -> None:
        self._index: dict[str, list[Toponym]] = {}
        db = db_path or DB_PATH
        if db.exists():
            self._load_sqlite(db)
        else:
            self._load_seed(seed_path or SEED_PATH)

    def _add(self, toponym: Toponym) -> None:
        self._index.setdefault(_fold(toponym.name), []).append(toponym)

    def _load_sqlite(self, path: Path) -> None:
        conn = sqlite3.connect(path)
        try:
            rows = conn.execute(
                "SELECT name, lat, lon, country, feature_class, population FROM toponyms"
            )
            for name, lat, lon, country, fclass, pop in rows:
                self._add(Toponym(name, float(lat), float(lon), country, fclass, int(pop or 0)))
        finally:
            conn.close()

    def _load_seed(self, path: Path) -> None:
        with path.open("r", encoding="utf-8") as fh:
            for row in csv.DictReader(fh, delimiter="\t"):
                self._add(
                    Toponym(
                        row["name"], float(row["lat"]), float(row["lon"]),
                        row["country"], row["feature_class"], int(row["population"] or 0),
                    )
                )

    def lookup(self, name: str, country_hint: str | None = None) -> Toponym | None:
        """Resolve ambiguidade por pais ja citado e depois por populacao/relevancia."""
        candidates = self._index.get(_fold(name), [])
        if not candidates:
            return None
        if country_hint:
            hinted = [c for c in candidates if _fold(c.country) == _fold(country_hint)]
            if hinted:
                candidates = hinted
        return max(candidates, key=lambda c: c.relevance)

    def __len__(self) -> int:
        return sum(len(v) for v in self._index.values())
