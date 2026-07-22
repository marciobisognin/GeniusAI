"""Severidade deterministica (Tarefa 4.4) e motor de alertas com cooldown (6.1)."""
import pytest

from backend.app.alerts.engine import AlertEngine
from backend.app.pipeline.stage3_llm_enrich import decide_severity, in_tension_zone


class TestDecideSeverity:
    def test_critical_needs_corroboration(self):
        # 1 fonte, fora de zona de tensao → rebaixa para high
        assert decide_severity("critical", 1, -30.0, -60.0) == "high"

    def test_critical_with_two_sources_keeps(self):
        assert decide_severity("critical", 2, -30.0, -60.0) == "critical"

    def test_critical_in_tension_zone_keeps(self):
        # Hormuz: zona de tensao configurada
        assert decide_severity("critical", 0, 26.6, 56.5) == "critical"

    def test_low_medium_pass_through(self):
        assert decide_severity("low", 0, None, None) == "low"
        assert decide_severity("medium", 0, None, None) == "medium"

    def test_invalid_suggestion_degrades_to_low(self):
        assert decide_severity("apocalyptic", 5, 26.6, 56.5) == "low"


def test_tension_zone_lookup():
    assert in_tension_zone(26.6, 56.5) is not None
    assert in_tension_zone(-33.9, 18.4) is None  # Cidade do Cabo: fora


class TestAlertEngine:
    @pytest.fixture
    def persisted(self):
        return []

    @pytest.fixture
    def engine(self, fake_redis, persisted):
        async def repo(alert):
            persisted.append(alert)

        return AlertEngine(fake_redis, alerts_repo=repo)

    async def test_critical_event_fires_alert(self, engine, persisted):
        event = {"event_id": 1, "severity": "critical", "title": "x", "lat": 0.0, "lon": 0.0}
        fired = await engine.process(event)
        assert len(fired) == 1 and fired[0]["rule_name"] == "critical_severity"
        assert len(persisted) == 1

    async def test_same_region_suppressed_within_cooldown(self, engine, persisted):
        event = {"event_id": 1, "severity": "critical", "title": "x", "lat": 10.0, "lon": 10.0}
        assert len(await engine.process(event)) == 1
        # equivalente na mesma regiao dentro de 1h → suprimido
        assert len(await engine.process({**event, "event_id": 2})) == 0
        assert len(persisted) == 1

    async def test_after_ttl_alerts_again(self, engine, fake_redis):
        event = {"event_id": 1, "severity": "critical", "title": "x", "lat": 10.0, "lon": 10.0}
        assert len(await engine.process(event)) == 1
        # simula expiracao do TTL de 3600s
        for key in list(fake_redis.store):
            if key.startswith("argus:alert_cooldown:"):
                del fake_redis.store[key]
        assert len(await engine.process({**event, "event_id": 3})) == 1

    async def test_tension_zone_rule(self, engine):
        event = {"event_id": 4, "severity": "high", "title": "hormuz", "lat": 26.6, "lon": 56.5}
        fired = await engine.process(event)
        assert any(rule["rule_name"].startswith("tension_zone:") for rule in fired)
