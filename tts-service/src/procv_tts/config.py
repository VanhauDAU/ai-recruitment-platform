from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


def _integer(name: str, default: int, *, minimum: int = 0) -> int:
    try:
        value = int(os.getenv(name, str(default)))
    except ValueError as error:
        raise RuntimeError(f"{name} must be an integer.") from error
    if value < minimum:
        raise RuntimeError(f"{name} must be at least {minimum}.")
    return value


def _floating(name: str, default: float, *, minimum: float = 0) -> float:
    try:
        value = float(os.getenv(name, str(default)))
    except ValueError as error:
        raise RuntimeError(f"{name} must be a number.") from error
    if value < minimum:
        raise RuntimeError(f"{name} must be at least {minimum}.")
    return value


def _choice(name: str, default: str, choices: set[str]) -> str:
    value = os.getenv(name, default).strip().lower()
    if value not in choices:
        rendered = ", ".join(sorted(choices))
        raise RuntimeError(f"{name} must be one of: {rendered}.")
    return value


def _boolean(name: str, default: bool) -> bool:
    value = os.getenv(name, "true" if default else "false").strip().lower()
    if value in {"1", "true", "yes"}:
        return True
    if value in {"0", "false", "no"}:
        return False
    raise RuntimeError(f"{name} must be a boolean.")


@dataclass(frozen=True)
class Settings:
    environment: str
    runtime_enabled: bool
    internal_token: str
    cache_dir: Path
    cache_max_bytes: int
    pcm_cache_ttl_seconds: int
    wav_cache_ttl_seconds: int
    artifact_cache_ttl_seconds: int
    session_ttl_seconds: int
    max_active_sessions: int
    max_text_chars: int
    max_concurrent_streams: int
    max_active_generations: int
    onnx_threads: int
    backend: str
    precision: str
    model_source: str
    model_revision: str
    ffmpeg_binary: str
    fake_engine: bool

    @classmethod
    def from_env(cls) -> Settings:
        environment = os.getenv("TTS_ENVIRONMENT", "development").strip().lower()
        runtime_default = environment != "production"
        runtime_enabled = _boolean("SPEECH_RUNTIME_ENABLED", runtime_default)
        internal_token = os.getenv(
            "TTS_INTERNAL_TOKEN", "dev-tts-internal-token-change-me"
        ).strip()
        if not internal_token:
            raise RuntimeError("TTS_INTERNAL_TOKEN must not be empty.")
        if (
            environment == "production"
            and internal_token == "dev-tts-internal-token-change-me"
        ):
            raise RuntimeError("TTS_INTERNAL_TOKEN must be changed in production.")

        cache_max_gb = _floating("TTS_CACHE_MAX_GB", 5.0, minimum=0.1)
        return cls(
            environment=environment,
            runtime_enabled=runtime_enabled,
            internal_token=internal_token,
            cache_dir=Path(
                os.getenv("TTS_CACHE_DIR", "/var/cache/procv-tts")
            ).resolve(),
            cache_max_bytes=int(cache_max_gb * 1024**3),
            pcm_cache_ttl_seconds=_integer(
                "TTS_PCM_CACHE_TTL_SECONDS", 24 * 86400, minimum=60
            ),
            wav_cache_ttl_seconds=_integer(
                "TTS_WAV_CACHE_TTL_SECONDS", 72 * 86400, minimum=60
            ),
            artifact_cache_ttl_seconds=_integer(
                "TTS_ARTIFACT_CACHE_TTL_SECONDS", 72 * 86400, minimum=60
            ),
            session_ttl_seconds=_integer("TTS_SESSION_TTL_SECONDS", 180, minimum=30),
            max_active_sessions=_integer("TTS_MAX_ACTIVE_SESSIONS", 1000, minimum=10),
            max_text_chars=_integer("TTS_MAX_TEXT_CHARS", 30_000, minimum=1000),
            max_concurrent_streams=_integer("TTS_MAX_CONCURRENT_STREAMS", 1, minimum=1),
            max_active_generations=_integer(
                "TTS_MAX_ACTIVE_GENERATIONS", 3, minimum=1
            ),
            # Auto (0) made ONNX consume every visible host core in Docker and
            # hurt both RTF and web responsiveness. Four is a safe baseline;
            # production can override it after benchmarking physical cores.
            onnx_threads=_integer("TTS_ONNX_THREADS", 2, minimum=0),
            backend=_choice("TTS_BACKEND", "onnx", {"onnx", "pytorch"}),
            precision=_choice("TTS_PRECISION", "int8", {"int8", "fp32"}),
            model_source=os.getenv(
                "TTS_MODEL_SOURCE", "pnnbao-ump/VieNeu-TTS-v3-Turbo"
            ).strip(),
            # Giá trị này tham gia cache key và metrics. Khi model được pin về
            # local snapshot, đặt đúng commit SHA để cache không lẫn phiên bản.
            model_revision=os.getenv(
                "TTS_MODEL_REVISION", "vieneu-3.2.3-v3-turbo-int8"
            ).strip(),
            ffmpeg_binary=os.getenv("TTS_FFMPEG_BINARY", "ffmpeg").strip(),
            fake_engine=_boolean("TTS_FAKE_ENGINE", False),
        )
