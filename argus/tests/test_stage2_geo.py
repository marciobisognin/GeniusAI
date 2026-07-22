"""DoD 4.3: 'Naval movement detected near the Strait of Hormuz, Iran' resolve
para ~26.6N, 56.5E sem LLM e sem chamada a servico externo publico."""
import pytest

from backend.app.pipeline.gazetteer import Gazetteer
from backend.app.pipeline.stage2_geo_ner import Stage2GeoNER


async def test_strait_of_hormuz_offline():
    stage = Stage2GeoNER(use_nominatim=False)  # nenhuma rede envolvida
    item = await stage.process(
        {"title": "Naval movement detected near the Strait of Hormuz, Iran",
         "summary": "", "language": "en"}
    )
    assert item is not None
    assert item["lat"] == pytest.approx(26.6, abs=0.5)
    assert item["lon"] == pytest.approx(56.5, abs=0.5)
    assert item["geo_confidence"] >= 0.5
    assert item["entities"]["LOC"] or item["entities"]["GPE"]


def test_gazetteer_ambiguity_by_country_hint():
    gaz = Gazetteer()
    top = gaz.lookup("Strait of Hormuz")
    assert top is not None and top.feature_class == "H"
    kyiv = gaz.lookup("Kyiv", country_hint="Ukraine")
    assert kyiv is not None and kyiv.country == "Ukraine"


async def test_pre_geolocated_source_skips_resolution():
    stage = Stage2GeoNER(use_nominatim=False)
    item = await stage.process(
        {"title": "M6.2 earthquake", "summary": "", "language": "en",
         "lat": 10.0, "lon": 20.0}
    )
    assert item["lat"] == 10.0 and item["lon"] == 20.0
    assert item["geo_confidence"] >= 0.9


async def test_unresolvable_toponym_keeps_no_coordinates():
    stage = Stage2GeoNER(use_nominatim=False)
    item = await stage.process(
        {"title": "meeting at Zzyzxville Undefined", "summary": "", "language": "en"}
    )
    assert "lat" not in item
    assert item["geo_confidence"] < 0.5
