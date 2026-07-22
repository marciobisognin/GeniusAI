"""Estagio 2: NER (spaCy) + geocodificacao offline em duas camadas.

Camada 1: gazetteer GeoNames local (cidades + feicoes H/T como "Strait of Hormuz").
Camada 2: Nominatim/Photon self-hosted (container local) para toponimos restantes.
Nenhuma chamada a servico externo publico; nenhuma LLM.
"""
from __future__ import annotations

import logging
import re
from typing import Any

import httpx
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from backend.app.core.config import get_settings
from backend.app.pipeline.gazetteer import Gazetteer

logger = logging.getLogger("argus.stage2")

NER_LABELS = {"GPE", "LOC", "ORG", "FAC"}
GAZETTEER_CONFIDENCE = {"H": 0.9, "T": 0.85, "P": 0.8}
NOMINATIM_CONFIDENCE = 0.6

# Fallback sem modelo spaCy: sequencias tituladas ("Strait of Hormuz", "New Delhi").
_TITLECASE = re.compile(r"\b(?:[A-Z][a-zA-Z'\-]+(?:\s+(?:of|the|el|de|da|do|al)\s+)?)+")


def _load_spacy(language: str) -> Any | None:
    model = {"pt": "pt_core_news_sm"}.get(language, "en_core_web_sm")
    try:
        import spacy

        return spacy.load(model)
    except Exception:
        logger.warning("modelo spaCy '%s' indisponivel; usando extrator regex", model)
        return None


class Stage2GeoNER:
    def __init__(
        self,
        gazetteer: Gazetteer | None = None,
        nominatim_url: str | None = None,
        use_nominatim: bool = True,
    ) -> None:
        self.gazetteer = gazetteer or Gazetteer()
        self.nominatim_url = (nominatim_url or get_settings().nominatim_url).rstrip("/")
        self.use_nominatim = use_nominatim
        self.threshold = get_settings().geo_confidence_threshold
        self._nlp: dict[str, Any] = {}

    def _nlp_for(self, language: str) -> Any | None:
        if language not in self._nlp:
            self._nlp[language] = _load_spacy(language)
        return self._nlp[language]

    def extract_entities(self, text: str, language: str) -> dict[str, list[str]]:
        nlp = self._nlp_for(language)
        entities: dict[str, list[str]] = {label: [] for label in NER_LABELS}
        if nlp is not None:
            for ent in nlp(text).ents:
                if ent.label_ in NER_LABELS and ent.text not in entities[ent.label_]:
                    entities[ent.label_].append(ent.text)
        else:
            for match in _TITLECASE.finditer(text):
                candidate = match.group().strip()
                if len(candidate.split()) >= 1 and candidate not in entities["LOC"]:
                    entities["LOC"].append(candidate)
        return entities

    @retry(
        retry=retry_if_exception_type(httpx.TransportError),
        stop=stop_after_attempt(2),
        wait=wait_exponential(multiplier=1, max=5),
        reraise=True,
    )
    async def _nominatim_lookup(self, name: str) -> tuple[float, float, str] | None:
        """Consulta o Nominatim/Photon LOCAL (Fase 1); nunca a instancia publica."""
        async with httpx.AsyncClient(timeout=get_settings().http_timeout_seconds) as client:
            resp = await client.get(
                f"{self.nominatim_url}/search",
                params={"q": name, "format": "jsonv2", "limit": 1},
                headers={"User-Agent": get_settings().user_agent},
            )
            resp.raise_for_status()
        results = resp.json()
        if not results:
            return None
        top = results[0]
        return float(top["lat"]), float(top["lon"]), top.get("display_name", "")

    async def process(self, item: dict) -> dict | None:
        """Anexa entities, lat/lon, country e geo_confidence. Item sem texto e descartado."""
        text = " ".join(filter(None, [item.get("title", ""), item.get("summary", "")]))
        language = item.get("language", "en")

        # Fontes ja geolocalizadas (GDELT GEO, USGS, GDACS...) pulam a resolucao.
        if item.get("lat") is not None and item.get("lon") is not None:
            item.setdefault("geo_confidence", 0.95)
            item.setdefault("entities", self.extract_entities(text, language))
            return item

        entities = self.extract_entities(text, language)
        item["entities"] = entities

        country_hint = next(
            (name for name in entities.get("GPE", []) + entities.get("LOC", [])
             if self.gazetteer.lookup(name) and self.gazetteer.lookup(name).feature_class == "P"),
            None,
        )

        candidates = entities.get("LOC", []) + entities.get("GPE", []) + entities.get("FAC", [])
        best: tuple[float, float, str, float] | None = None  # lat, lon, country, conf
        for name in candidates:
            toponym = self.gazetteer.lookup(name, country_hint=country_hint)
            if toponym:
                conf = GAZETTEER_CONFIDENCE[toponym.feature_class]
                if best is None or conf > best[3]:
                    best = (toponym.lat, toponym.lon, toponym.country, conf)

        if best is None and self.use_nominatim:
            for name in candidates:
                try:
                    hit = await self._nominatim_lookup(name)
                except Exception as exc:
                    logger.warning("nominatim local falhou p/ %r: %r", name, exc)
                    continue
                if hit:
                    best = (hit[0], hit[1], hit[2], NOMINATIM_CONFIDENCE)
                    break

        if best is not None and best[3] >= self.threshold:
            item["lat"], item["lon"], item["country"], item["geo_confidence"] = best
        else:
            # Sem coordenadas confiaveis: evento segue sem geometria (nao inventamos).
            item["geo_confidence"] = best[3] if best else 0.0
        return item
