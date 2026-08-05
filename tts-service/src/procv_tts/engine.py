from __future__ import annotations

import logging
import math
import threading
import time
from collections.abc import Iterator

import numpy as np

from .config import Settings
from .voices import DEFAULT_VOICE_ID, STYLES, VOICE_BY_ID, VOICE_PRESETS

logger = logging.getLogger("procv_tts")


class VieneuRuntime:
    sample_rate = 48_000

    def __init__(self, settings: Settings):
        self.settings = settings
        self._engine = None
        self._ready = False
        self._load_error = ""
        self._available_voice_ids: set[str] = set()
        self._guard = threading.Lock()

    @property
    def ready(self) -> bool:
        return self._ready

    @property
    def load_error(self) -> str:
        return self._load_error

    @property
    def native_streaming(self) -> bool:
        return self.settings.backend == "onnx"

    def load(self) -> None:
        with self._guard:
            if self._ready:
                return
            try:
                if self.settings.fake_engine:
                    self._engine = _FakeVieneuEngine(self.sample_rate)
                else:
                    from vieneu import Vieneu

                    engine_options = dict(
                        mode="v3turbo",
                        backend=self.settings.backend,
                        precision=self.settings.precision,
                        backbone_repo=self.settings.model_source,
                    )
                    if self.settings.backend == "onnx":
                        engine_options["threads"] = self.settings.onnx_threads
                    self._engine = Vieneu(**engine_options)
                installed = {
                    item[1]
                    if isinstance(item, (tuple, list)) and len(item) == 2
                    else str(item)
                    for item in self._engine.list_preset_voices()
                }
                self._available_voice_ids = {
                    voice.id
                    for voice in VOICE_PRESETS
                    if voice.engine_name in installed
                }
                if not self._available_voice_ids:
                    raise RuntimeError("No curated VieNeu preset voice is available.")
                self._ready = True
                self._load_error = ""
            except Exception as error:
                self._engine = None
                self._ready = False
                self._load_error = type(error).__name__
                raise

    def close(self) -> None:
        engine = self._engine
        self._engine = None
        self._ready = False
        close = getattr(engine, "close", None)
        if callable(close):
            close()

    def capabilities(self) -> dict:
        voices = [
            voice.public_dict()
            for voice in VOICE_PRESETS
            if voice.id in self._available_voice_ids
        ]
        default_voice_id = (
            DEFAULT_VOICE_ID
            if DEFAULT_VOICE_ID in self._available_voice_ids
            else voices[0]["id"]
        )
        return {
            "model_revision": self.settings.model_revision,
            "sample_rate": self.sample_rate,
            "backend": self.settings.backend,
            "precision": self.settings.precision,
            "native_streaming": self.native_streaming,
            "default_voice_id": default_voice_id,
            "voices": voices,
            "styles": list(STYLES),
        }

    def warmup(self) -> None:
        """Chạy một lượt suy luận ngắn để ONNX session sẵn sàng trước request thật."""
        if not self._ready or self._engine is None:
            return
        voice_id = (
            DEFAULT_VOICE_ID
            if DEFAULT_VOICE_ID in self._available_voice_ids
            else next(iter(self._available_voice_ids))
        )
        started_at = time.perf_counter()
        try:
            for _ in self.infer_chunks(
                "Xin chào.",
                voice_id=voice_id,
                style="tu_nhien",
                interactive=self.native_streaming,
            ):
                pass
        except Exception:
            # Warmup chỉ để làm nóng; lỗi ở đây không được chặn service khởi động.
            logger.warning("speech_warmup_failed voice_id=%s", voice_id, exc_info=True)
            return
        logger.info(
            "speech_warmup_complete voice_id=%s elapsed_ms=%.0f",
            voice_id,
            (time.perf_counter() - started_at) * 1000,
        )

    def infer_stream(
        self, text: str, *, voice_id: str, style: str
    ) -> Iterator[np.ndarray]:
        """Backward-compatible alias for latency-sensitive inference."""
        yield from self.infer_chunks(
            text, voice_id=voice_id, style=style, interactive=True
        )

    def infer_chunks(
        self,
        text: str,
        *,
        voice_id: str,
        style: str,
        interactive: bool,
    ) -> Iterator[np.ndarray]:
        if not self._ready or self._engine is None:
            raise RuntimeError("VieNeu runtime is not ready.")
        voice = VOICE_BY_ID[voice_id]
        options = {
            "voice": voice.engine_name,
            "style": style,
            "apply_watermark": True,
        }
        # VieNeu's native incremental path is implemented by the ONNX backend.
        # PyTorch returns a complete segment. Keeping segments bounded preserves
        # fairness even when a future non-interactive consumer shares the model.
        if self.native_streaming:
            yield from self._engine.infer_stream(text, **options)
            return

        audio = self._engine.infer(text, **options)
        if isinstance(audio, tuple):
            audio = audio[0]
        yield np.asarray(audio, dtype=np.float32)


class _FakeVieneuEngine:
    """Small deterministic engine used by tests and contract smoke checks."""

    def __init__(self, sample_rate: int):
        self.sample_rate = sample_rate
        self.infer_calls: list[str] = []

    def list_preset_voices(self):
        return [(voice.label, voice.engine_name) for voice in VOICE_PRESETS]

    def infer_stream(self, text, **_kwargs):
        self.infer_calls.append(text)
        duration = min(30.0, max(0.08, len(text) / 100))
        count = int(self.sample_rate * duration)
        timeline = np.arange(count, dtype=np.float32) / self.sample_rate
        audio = (0.025 * np.sin(2 * math.pi * 220 * timeline)).astype(np.float32)
        frame = self.sample_rate // 10
        for offset in range(0, len(audio), frame):
            yield audio[offset : offset + frame]

    def infer(self, text, **kwargs):
        return np.concatenate(list(self.infer_stream(text, **kwargs)))
