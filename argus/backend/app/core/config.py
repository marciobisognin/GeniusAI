"""Configuracao central via pydantic-settings (.env + variaveis de ambiente)."""
from __future__ import annotations

from enum import Enum
from functools import lru_cache
from pathlib import Path
from typing import Any

import yaml
from pydantic_settings import BaseSettings, SettingsConfigDict

PROJECT_ROOT = Path(__file__).resolve().parents[3]
CONFIG_DIR = PROJECT_ROOT / "config"
DATA_DIR = PROJECT_ROOT / "data"


class LLMProfile(str, Enum):
    LOCAL_ONLY = "LOCAL_ONLY"
    HYBRID = "HYBRID"
    CLOUD_PREFERRED = "CLOUD_PREFERRED"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = "postgresql+asyncpg://argus:argus@localhost:5432/argus"
    redis_url: str = "redis://localhost:6379/0"
    ollama_base_url: str = "http://localhost:11434"
    nominatim_url: str = "http://localhost:8080"

    openrouter_api_key: str = ""
    anthropic_api_key: str = ""
    openai_api_key: str = ""
    aisstream_api_key: str = ""
    firms_map_key: str = ""

    mastodon_instance: str = "https://mastodon.social"

    llm_profile: LLMProfile = LLMProfile.LOCAL_ONLY

    http_timeout_seconds: float = 20.0
    user_agent: str = "ARGUS-OSINT/0.1 (open-source research; +https://github.com)"

    geo_confidence_threshold: float = 0.5


@lru_cache
def get_settings() -> Settings:
    return Settings()


def load_yaml_config(name: str) -> dict[str, Any]:
    """Carrega um YAML de `config/` (ex.: 'models', 'sources')."""
    path = CONFIG_DIR / f"{name}.yaml"
    with path.open("r", encoding="utf-8") as fh:
        data = yaml.safe_load(fh)
    if not isinstance(data, dict):
        raise ValueError(f"config/{name}.yaml deve conter um mapeamento no topo")
    return data
