from __future__ import annotations

import hmac
import logging
import re
import shutil
import struct
import threading
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Header, HTTPException, Response, status
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel, Field, field_validator, model_validator

from .artifacts import Mp3ArtifactStore
from .cache import AudioCache
from .config import Settings
from .engine import VieneuRuntime
from .identity import artifact_identity, text_hash
from .metrics import RuntimeMetrics
from .scheduler import SegmentScheduler
from .segmentation import split_for_speech
from .sessions import SpeechSessionStore
from .voices import STYLE_IDS, VOICE_BY_ID

logger = logging.getLogger("procv_tts")
# Uvicorn chỉ cấu hình logger của chính nó, nên root vẫn ở mức WARNING và toàn
# bộ metric ttfa/rtf dưới đây bị nuốt. Bật handler riêng để còn chẩn đoán được
# khi người dùng báo tiếng bị ngắt quãng.
if not logger.handlers:
    _handler = logging.StreamHandler()
    _handler.setFormatter(logging.Formatter("%(levelname)s:     %(name)s %(message)s"))
    logger.addHandler(_handler)
    logger.setLevel(logging.INFO)
    logger.propagate = False
settings = Settings.from_env()
runtime = VieneuRuntime(settings)
sessions = SpeechSessionStore(
    settings.session_ttl_seconds, settings.max_active_sessions
)
audio_cache = AudioCache(
    settings.cache_dir,
    max_bytes=settings.cache_max_bytes,
    ttl_by_suffix={
        ".pcm": settings.pcm_cache_ttl_seconds,
        ".wav": settings.wav_cache_ttl_seconds,
        ".mp3": settings.artifact_cache_ttl_seconds,
        ".meta.json": settings.artifact_cache_ttl_seconds,
    },
)
segment_scheduler = SegmentScheduler(
    runtime,
    audio_cache,
    workers=settings.max_concurrent_streams,
    model_revision=settings.model_revision,
)
artifact_store = Mp3ArtifactStore(
    settings, audio_cache, sample_rate=runtime.sample_rate
)
runtime_metrics = RuntimeMetrics()
_cache_stats_value = {"files": 0, "size_bytes": 0}
_cache_stats_at = 0.0
_cache_stats_guard = threading.Lock()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    if not settings.runtime_enabled:
        logger.warning("speech_runtime_disabled environment=%s", settings.environment)
        yield
        return
    runtime.load()
    audio_cache.prune(force=True)
    # Lần suy luận đầu tiên phải dựng ONNX session và cấp phát arena nên chậm
    # hơn nhiều lần so với lúc nóng máy. Nếu để request thật gánh chi phí đó,
    # tốc độ sinh tụt xuống dưới thời gian thực và client chắc chắn bị hụt đệm.
    runtime.warmup()
    segment_scheduler.start()
    yield
    segment_scheduler.close()
    artifact_store.close()
    runtime.close()


app = FastAPI(
    title="ProCV VieNeu-TTS",
    version="0.1.0",
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
    lifespan=lifespan,
)


class SessionCreateRequest(BaseModel):
    text: str = Field(min_length=1)
    voice_id: str = Field(min_length=1, max_length=64)
    style: str = Field(min_length=1, max_length=32)
    text_hash: str = Field(pattern=r"^[a-f0-9]{64}$")
    normalizer_version: str = Field(pattern=r"^[a-z0-9._-]{1,64}$")
    source_revision: str = Field(min_length=1, max_length=160)
    artifact_policy: str = Field(default="cache_only", pattern=r"^(cache_only|durable)$")

    @field_validator("text")
    @classmethod
    def normalize_text(cls, value: str) -> str:
        value = value.strip()
        if len(value) > settings.max_text_chars:
            raise ValueError(
                f"Text exceeds the {settings.max_text_chars}-character limit."
            )
        return value

    @field_validator("voice_id")
    @classmethod
    def known_voice(cls, value: str) -> str:
        if value not in VOICE_BY_ID:
            raise ValueError("Unknown voice_id.")
        return value

    @field_validator("style")
    @classmethod
    def known_style(cls, value: str) -> str:
        if value not in STYLE_IDS:
            raise ValueError("Unknown style.")
        return value

    @model_validator(mode="after")
    def matching_text_hash(self):
        if text_hash(self.text) != self.text_hash:
            raise ValueError("text_hash does not match normalized text.")
        return self


def _require_internal_token(value: str | None) -> None:
    if value is None or not hmac.compare_digest(value, settings.internal_token):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found.")


def _artifact_identity(request: SessionCreateRequest) -> tuple[str, str]:
    return artifact_identity(
        text_digest=request.text_hash,
        source_revision=request.source_revision,
        voice_id=request.voice_id,
        style=request.style,
        model_source=settings.model_source,
        model_revision=settings.model_revision,
        backend=settings.backend,
        precision=settings.precision,
        sample_rate=runtime.sample_rate,
        text_normalizer=request.normalizer_version,
    )


def _wav_header(data_bytes: int) -> bytes:
    sample_rate = runtime.sample_rate
    return struct.pack(
        "<4sI4s4sIHHIIHH4sI",
        b"RIFF",
        36 + data_bytes if data_bytes != 0xFFFFFFFF else 0xFFFFFFFF,
        b"WAVE",
        b"fmt ",
        16,
        1,
        1,
        sample_rate,
        sample_rate * 2,
        2,
        16,
        b"data",
        data_bytes,
    )


def _wav_stream_header() -> bytes:
    # Streaming chưa biết trước độ dài. Dùng sentinel RIFF/data size thay vì
    # wave.setnframes(): wave sẽ ghi đè về 0 khi đóng file chưa có frame.
    return _wav_header(0xFFFFFFFF)


_generations: dict[str, _Generation] = {}
_generations_guard = threading.Lock()
READER_POLL_SECONDS = 0.5


class _Generation:
    """Một lượt sinh audio chạy độc lập với kết nối HTTP của client.

    Trước đây generator sinh audio nằm ngay trong response: client ngắt giữa
    chừng (bấm phát lại, đổi giọng, rời trang) thì lượt sinh vẫn chạy tiếp trong
    thread pool nhưng phần đã sinh bị vứt đi, mà slot engine thì giữ nguyên tới
    khi chạy xong. Người nghe bấm lại liền sau đó chỉ nhận 429/503.

    Nay lượt sinh ghi PCM thô vào một file tạm và mọi request cùng cache key đều
    bám đuôi file đó. Ngắt kết nối không huỷ việc đang làm, và người nghe bấm
    lại sẽ nhận ngay phần đã sinh rồi chạy tiếp theo thời gian thực.
    """

    def __init__(self, cache_key: str, item, path):
        self.cache_key = cache_key
        self.item = item
        self.path = path
        self.size = 0
        self.done = False
        self.failed = False
        self.condition = threading.Condition()
        self.admitted_at = time.perf_counter()
        # Mở ngay tại đây để reader luôn mở được file: nếu đợi thread sinh tạo
        # file thì request bám đuôi có thể chạy trước và gặp FileNotFoundError.
        self.output = open(path, "wb")

    def _publish(self, size: int) -> None:
        with self.condition:
            self.size = size
            self.condition.notify_all()

    def _finish(self, *, failed: bool) -> None:
        with self.condition:
            self.done = True
            self.failed = failed
            self.condition.notify_all()

    def run(self) -> None:
        started_at = time.perf_counter()
        runtime_metrics.generation_started()
        first_audio_at = None
        sample_count = 0
        failed = True
        try:
            if self.item.artifact_policy == "durable":
                artifact_store.mark_generating(self.cache_key)
            with self.output as output:
                for segment in split_for_speech(self.item.text):
                    # A model worker is held for this bounded segment only.
                    # The next segment is enqueued after yielding, so another
                    # article can run and background artifacts cannot starve it.
                    for pcm in segment_scheduler.stream(
                        text=segment,
                        voice_id=self.item.voice_id,
                        style=self.item.style,
                    ):
                        if not pcm:
                            continue
                        if first_audio_at is None:
                            first_audio_at = time.perf_counter()
                        output.write(pcm)
                        # Readers tail this file while it is being generated.
                        output.flush()
                        sample_count += len(pcm) // 2
                        self._publish(output.tell())
            wav_path = audio_cache.commit_pcm(
                self.path,
                self.cache_key,
                _wav_header(self.size),
            )
            # Encoding is detached from the response completion, but it reads
            # the exact immutable WAV assembled from the live PCM tee. No model
            # call and no second synthesis path is involved.
            if self.item.artifact_policy == "durable":
                artifact_store.ensure_from_wav_async(
                    artifact_key=self.cache_key,
                    wav_path=wav_path,
                )
            failed = False
        except Exception:
            if self.item.artifact_policy == "durable":
                artifact_store.mark_failed(self.cache_key, "inference_failed")
            logger.exception(
                "speech_stream_failed voice_id=%s style=%s",
                self.item.voice_id,
                self.item.style,
            )
        finally:
            if failed:
                audio_cache.abort(self.path)
            with _generations_guard:
                if _generations.get(self.cache_key) is self:
                    del _generations[self.cache_key]
            self._finish(failed=failed)
            elapsed = time.perf_counter() - started_at
            audio_seconds = sample_count / runtime.sample_rate
            ttfa_ms = (
                (first_audio_at - started_at) * 1000 if first_audio_at else None
            )
            rtf = elapsed / audio_seconds if audio_seconds else None
            runtime_metrics.generation_finished(
                completed=not failed,
                audio_seconds=audio_seconds,
                ttfa_ms=ttfa_ms,
                rtf=rtf,
                queue_wait_ms=(started_at - self.admitted_at) * 1000,
            )
            logger.info(
                "speech_stream_complete voice_id=%s style=%s ttfa_ms=%.0f rtf=%.3f audio_seconds=%.2f completed=%s",
                self.item.voice_id,
                self.item.style,
                ttfa_ms if ttfa_ms is not None else -1,
                rtf if rtf is not None else 0,
                audio_seconds,
                not failed,
            )

    def tail(self):
        """Phát header rồi bám đuôi file PCM cho tới khi lượt sinh kết thúc."""
        yield _wav_stream_header()
        offset = 0
        source_offset = 0
        try:
            source = open(self.path, "rb")
        except FileNotFoundError:
            # Generation may have atomically committed between the first cache
            # lookup and this response iterator being consumed.
            source = open(audio_cache.path(self.cache_key), "rb")
            source_offset = 44
        with source:
            while True:
                with self.condition:
                    while self.size <= offset and not self.done:
                        self.condition.wait(READER_POLL_SECONDS)
                    available, done = self.size, self.done
                if available > offset:
                    source.seek(source_offset + offset)
                    data = source.read(available - offset)
                    if data:
                        offset += len(data)
                        yield data
                        continue
                if done and available <= offset:
                    if self.failed:
                        raise RuntimeError("Speech article generation failed.")
                    return


@app.get("/healthz")
def healthz():
    return {"status": "ok"}


@app.get("/readyz")
def readyz():
    if not settings.runtime_enabled:
        return Response(
            content='{"status":"disabled"}',
            media_type="application/json",
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        )
    if not runtime.ready:
        return Response(status_code=status.HTTP_503_SERVICE_UNAVAILABLE)
    return {
        "status": "ready",
        "model_revision": settings.model_revision,
        "backend": settings.backend,
        "precision": settings.precision,
        "native_streaming": runtime.native_streaming,
        "model_workers": settings.max_concurrent_streams,
        "onnx_threads": settings.onnx_threads if settings.backend == "onnx" else None,
        "ffmpeg_available": shutil.which(settings.ffmpeg_binary) is not None,
        "capacity": settings.max_active_generations,
    }


def _cached_cache_stats() -> dict[str, int]:
    global _cache_stats_at, _cache_stats_value
    now = time.monotonic()
    with _cache_stats_guard:
        if now - _cache_stats_at >= 60:
            _cache_stats_value = audio_cache.stats()
            _cache_stats_at = now
        return dict(_cache_stats_value)


@app.get("/internal/v1/status")
def internal_status(x_tts_internal_token: str | None = Header(default=None)):
    _require_internal_token(x_tts_internal_token)
    with _generations_guard:
        active = len(_generations)
    return {
        "status": "ready" if runtime.ready else (
            "disabled" if not settings.runtime_enabled else "unavailable"
        ),
        "environment": settings.environment,
        "runtime_enabled": settings.runtime_enabled,
        "model_revision": settings.model_revision,
        "backend": settings.backend,
        "precision": settings.precision,
        "native_streaming": runtime.native_streaming,
        "model_workers": settings.max_concurrent_streams,
        "onnx_threads": settings.onnx_threads if settings.backend == "onnx" else None,
        "ffmpeg_available": shutil.which(settings.ffmpeg_binary) is not None,
        "generations": {
            "active": active,
            "capacity": settings.max_active_generations,
            "available": max(0, settings.max_active_generations - active),
            "segment_queue": segment_scheduler.queue_size,
        },
        "metrics": runtime_metrics.snapshot(),
        "cache": _cached_cache_stats(),
    }


@app.get("/internal/v1/capabilities")
def capabilities(x_tts_internal_token: str | None = Header(default=None)):
    _require_internal_token(x_tts_internal_token)
    if not runtime.ready:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Not ready."
        )
    return runtime.capabilities()


@app.post("/internal/v1/sessions", status_code=status.HTTP_201_CREATED)
def create_session(
    request: SessionCreateRequest,
    x_tts_internal_token: str | None = Header(default=None),
):
    _require_internal_token(x_tts_internal_token)
    if not runtime.ready:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Not ready."
        )
    if request.voice_id not in {
        voice["id"] for voice in runtime.capabilities()["voices"]
    }:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Voice unavailable.",
        )

    artifact_key, config_hash = _artifact_identity(request)
    token, item = sessions.create(
        text=request.text,
        voice_id=request.voice_id,
        style=request.style,
        artifact_key=artifact_key,
        artifact_policy=request.artifact_policy,
    )
    return {
        "stream_path": f"/tts/v1/streams/{token}",
        "expires_at": item.expires_at,
        "artifact_key": artifact_key,
        "artifact_status": (
            artifact_store.status(artifact_key)["status"]
            if request.artifact_policy == "durable"
            else "CACHE_ONLY"
        ),
        "config_hash": config_hash,
        "model_revision": settings.model_revision,
        "cached": audio_cache.get(artifact_key) is not None,
        "sample_rate": runtime.sample_rate,
    }


@app.get("/internal/v1/artifacts/{artifact_key}")
def artifact_status(
    artifact_key: str,
    x_tts_internal_token: str | None = Header(default=None),
):
    _require_internal_token(x_tts_internal_token)
    if re.fullmatch(r"[a-f0-9]{64}", artifact_key) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found.")
    with _generations_guard:
        generating = artifact_key in _generations
    if generating:
        return {"artifact_key": artifact_key, "status": "GENERATING"}
    return artifact_store.status(artifact_key)


@app.get("/tts/v1/assets/{asset_key}.mp3")
def get_asset(asset_key: str):
    if re.fullmatch(r"[a-f0-9]{64}", asset_key) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found.")
    metadata = artifact_store.status(asset_key)
    asset = audio_cache.get(asset_key, ".mp3")
    if metadata.get("status") != "READY" or asset is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found.")
    return FileResponse(
        asset,
        media_type="audio/mpeg",
        headers={
            "Accept-Ranges": "bytes",
            "Cache-Control": "public, max-age=31536000, immutable",
            "X-Content-Type-Options": "nosniff",
        },
    )


@app.get("/tts/v1/streams/{token}")
def stream(token: str):
    item = sessions.get(token)
    if item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Stream expired."
        )

    artifact_key = item.artifact_key
    headers = {
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
    }
    cached = audio_cache.get(artifact_key)
    runtime_metrics.cache_lookup(hit=cached is not None)
    if cached is not None:
        if item.artifact_policy == "durable":
            artifact_store.ensure_from_wav_async(
                artifact_key=artifact_key,
                wav_path=cached,
            )
        return FileResponse(cached, media_type="audio/wav", headers=headers)

    start_generation = False
    with _generations_guard:
        generation = _generations.get(artifact_key)
        if generation is None:
            if len(_generations) >= settings.max_active_generations:
                runtime_metrics.rejected()
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Speech generation capacity is full.",
                    headers={"Retry-After": "2"},
                )
            generation = _Generation(
                artifact_key,
                item,
                audio_cache.temporary_path(artifact_key),
            )
            _generations[artifact_key] = generation
            start_generation = True
    if start_generation:
        threading.Thread(
            target=generation.run,
            name=f"tts-generate-{artifact_key[:8]}",
            daemon=True,
        ).start()

    return StreamingResponse(generation.tail(), media_type="audio/wav", headers=headers)
