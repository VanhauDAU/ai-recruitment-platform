from __future__ import annotations

import math
import logging
import os
import subprocess
import threading
import time
import wave
from pathlib import Path

import numpy as np

from .cache import AudioCache
from .config import Settings

logger = logging.getLogger("procv_tts")

MP3_BITRATE = "96k"
MP3_MIME_TYPE = "audio/mpeg"
MIN_AUDIO_SECONDS = 0.25
MIN_PCM_PEAK = 32
MIN_PCM_RMS = 8.0


class ArtifactEncodingError(RuntimeError):
    pass


class Mp3ArtifactStore:
    """Publish an MP3 from the exact PCM bytes already sent to live readers."""

    def __init__(self, settings: Settings, cache: AudioCache, *, sample_rate: int):
        self.settings = settings
        self.cache = cache
        self.sample_rate = sample_rate
        self._encoding: set[str] = set()
        self._encoding_threads: dict[str, threading.Thread] = {}
        self._encoding_guard = threading.Lock()

    def close(self, timeout: float = 15.0) -> None:
        deadline = time.monotonic() + timeout
        with self._encoding_guard:
            threads = list(self._encoding_threads.values())
        for thread in threads:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                return
            thread.join(remaining)

    def mark_generating(self, artifact_key: str) -> None:
        self.cache.commit_metadata(
            artifact_key,
            {
                "artifact_key": artifact_key,
                "status": "GENERATING",
                "updated_at": time.time(),
            },
        )

    def mark_failed(self, artifact_key: str, error_code: str) -> None:
        self.cache.commit_metadata(
            artifact_key,
            {
                "artifact_key": artifact_key,
                "error_code": error_code,
                "status": "FAILED",
                "updated_at": time.time(),
            },
        )

    def status(self, artifact_key: str) -> dict:
        metadata = self.cache.get_metadata(artifact_key)
        if metadata is None:
            return {"artifact_key": artifact_key, "status": "MISSING"}
        if metadata.get("status") != "READY":
            return metadata
        asset = self.cache.get(artifact_key, ".mp3")
        if asset is None:
            return {"artifact_key": artifact_key, "status": "MISSING"}
        return metadata

    def ensure_from_wav_async(self, *, artifact_key: str, wav_path: Path) -> None:
        if self.status(artifact_key).get("status") == "READY":
            return
        with self._encoding_guard:
            if artifact_key in self._encoding:
                return
            self._encoding.add(artifact_key)
        self.mark_generating(artifact_key)

        def encode() -> None:
            try:
                self.publish_from_wav(artifact_key=artifact_key, wav_path=wav_path)
            except Exception:
                logger.exception("speech_mp3_publish_failed key=%s", artifact_key[:12])
            finally:
                with self._encoding_guard:
                    self._encoding.discard(artifact_key)
                    self._encoding_threads.pop(artifact_key, None)

        thread = threading.Thread(
            target=encode,
            name=f"tts-mp3-{artifact_key[:8]}",
            daemon=True,
        )
        with self._encoding_guard:
            self._encoding_threads[artifact_key] = thread
        thread.start()

    def publish_from_wav(
        self,
        *,
        artifact_key: str,
        wav_path: Path,
    ) -> dict:
        with self.cache.lock_for(f"artifact:{artifact_key}"):
            cached = self.status(artifact_key)
            if cached.get("status") == "READY":
                return cached

            temporary = self.cache.temporary_path(artifact_key, ".mp3.part")
            try:
                self.mark_generating(artifact_key)
                sample_count = _validate_wav(wav_path, sample_rate=self.sample_rate)
                _encode_mp3(
                    wav_path,
                    temporary,
                    ffmpeg_binary=self.settings.ffmpeg_binary,
                )
                asset = self.cache.commit(temporary, artifact_key, ".mp3")
            except Exception:
                self.cache.abort(temporary)
                self.mark_failed(artifact_key, "mp3_encoding_failed")
                raise

            metadata = {
                "artifact_key": artifact_key,
                "asset_url": f"/tts/v1/assets/{artifact_key}.mp3",
                "duration_ms": round(sample_count * 1000 / self.sample_rate),
                "mime_type": MP3_MIME_TYPE,
                "sample_rate": self.sample_rate,
                "size_bytes": asset.stat().st_size,
                "status": "READY",
                "updated_at": time.time(),
            }
            self.cache.commit_metadata(artifact_key, metadata)
            return metadata


def _validate_wav(path: Path, *, sample_rate: int) -> int:
    try:
        source = wave.open(os.fspath(path), "rb")
    except (OSError, wave.Error) as error:
        raise ArtifactEncodingError("WAV source is unavailable or invalid.") from error
    with source:
        if (
            source.getnchannels() != 1
            or source.getsampwidth() != 2
            or source.getframerate() != sample_rate
            or source.getcomptype() != "NONE"
        ):
            raise ArtifactEncodingError("WAV source format is inconsistent.")
        sample_count = source.getnframes()
        if sample_count < round(sample_rate * MIN_AUDIO_SECONDS):
            raise ArtifactEncodingError("WAV source is too short.")

        peak = 0
        squared_sum = 0
        counted = 0
        while chunk := source.readframes(512 * 1024):
            samples = np.frombuffer(chunk, dtype="<i2")
            if samples.size:
                peak = max(peak, int(np.max(np.abs(samples.astype(np.int32)))))
                floated = samples.astype(np.float64)
                squared_sum += float(np.dot(floated, floated))
                counted += int(samples.size)
    rms = math.sqrt(squared_sum / counted) if counted else 0.0
    if peak < MIN_PCM_PEAK or rms < MIN_PCM_RMS:
        raise ArtifactEncodingError("WAV source is silent or degenerate.")
    return sample_count


def _encode_mp3(wav_path: Path, target: Path, *, ffmpeg_binary: str) -> None:
    command = [
        ffmpeg_binary,
        "-hide_banner",
        "-loglevel",
        "error",
        "-nostdin",
        "-y",
        "-i",
        os.fspath(wav_path),
        "-vn",
        "-codec:a",
        "libmp3lame",
        "-b:a",
        MP3_BITRATE,
        "-ac",
        "1",
        "-map_metadata",
        "-1",
        "-f",
        "mp3",
        os.fspath(target),
    ]
    try:
        completed = subprocess.run(
            command,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
            check=False,
        )
    except OSError as error:
        raise ArtifactEncodingError("ffmpeg is unavailable.") from error
    if completed.returncode != 0:
        message = completed.stderr.decode("utf-8", errors="replace").strip()
        raise ArtifactEncodingError(message or "ffmpeg failed to encode MP3.")
