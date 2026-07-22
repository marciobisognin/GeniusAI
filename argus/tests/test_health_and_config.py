"""DoD 1.1: GET /health responde 200 {'status':'ok'}; configs YAML validas."""
from fastapi.testclient import TestClient

from backend.app.core.config import LLMProfile, Settings, load_yaml_config


def test_health_endpoint():
    from backend.app.main import app

    with TestClient(app, raise_server_exceptions=False) as client:
        resp = client.get("/health")
        assert resp.status_code == 200
        assert resp.json() == {"status": "ok"}


def test_settings_defaults_local_only():
    settings = Settings(_env_file=None)
    assert settings.llm_profile == LLMProfile.LOCAL_ONLY
    assert settings.database_url.startswith("postgresql+asyncpg://")


def test_models_yaml_has_profiles_and_prices():
    cfg = load_yaml_config("models")
    assert set(cfg["profiles"]) == {"LOCAL_ONLY", "HYBRID", "CLOUD_PREFERRED"}
    for model in cfg["models"].values():
        assert "input_per_mtok" in model


def test_sources_yaml_catalog():
    cfg = load_yaml_config("sources")
    for key in ("rss", "gdelt", "ucdp", "reliefweb", "gdacs", "usgs", "firms",
                "adsb", "ais", "mastodon"):
        assert key in cfg
    for feed in cfg["rss"]:
        assert {"name", "url", "language", "interval_minutes"} <= set(feed)
