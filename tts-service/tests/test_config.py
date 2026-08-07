from procv_tts.config import Settings


def test_runtime_defaults_off_in_production(monkeypatch):
    monkeypatch.setenv("TTS_ENVIRONMENT", "production")
    monkeypatch.setenv("TTS_INTERNAL_TOKEN", "production-secret")
    monkeypatch.delenv("SPEECH_RUNTIME_ENABLED", raising=False)

    assert Settings.from_env().runtime_enabled is False


def test_runtime_defaults_on_outside_production(monkeypatch):
    monkeypatch.setenv("TTS_ENVIRONMENT", "development")
    monkeypatch.delenv("SPEECH_RUNTIME_ENABLED", raising=False)

    assert Settings.from_env().runtime_enabled is True
