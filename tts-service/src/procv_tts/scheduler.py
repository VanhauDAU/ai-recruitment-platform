from __future__ import annotations

import hashlib
import itertools
import logging
import queue
import threading
import time
from collections.abc import Iterator
from concurrent.futures import Future
from dataclasses import dataclass
from enum import IntEnum
from pathlib import Path

import numpy as np

from .cache import AudioCache
from .engine import VieneuRuntime

logger = logging.getLogger("procv_tts")


class GenerationPriority(IntEnum):
    INTERACTIVE = 0
    BACKGROUND = 10


@dataclass
class _SegmentState:
    key: str
    temporary: Path
    future: Future[Path]
    size: int = 0
    done: bool = False
    failed: bool = False
    final_path: Path | None = None

    def __post_init__(self) -> None:
        self.condition = threading.Condition()

    def publish(self, size: int) -> None:
        with self.condition:
            self.size = size
            self.condition.notify_all()

    def finish(self, *, failed: bool, final_path: Path | None = None) -> None:
        with self.condition:
            self.done = True
            self.failed = failed
            self.final_path = final_path
            self.condition.notify_all()

    def tail(self) -> Iterator[bytes]:
        """Yield PCM as produced; closing a reader never cancels inference."""
        try:
            source = open(self.temporary, "rb")
        except FileNotFoundError:
            # A very fast/cached fake engine may commit before this reader opens.
            with self.condition:
                final_path = self.final_path
            if final_path is None:
                raise
            source = open(final_path, "rb")

        offset = 0
        with source:
            while True:
                with self.condition:
                    while self.size <= offset and not self.done:
                        self.condition.wait(0.25)
                    available, done, failed = self.size, self.done, self.failed
                if available > offset:
                    source.seek(offset)
                    data = source.read(available - offset)
                    if data:
                        offset += len(data)
                        yield data
                        continue
                if done and available <= offset:
                    if failed:
                        raise RuntimeError("Speech segment generation failed.")
                    return


@dataclass(frozen=True)
class _SegmentJob:
    key: str
    text: str
    voice_id: str
    style: str
    interactive: bool
    state: _SegmentState


class SegmentScheduler:
    """Fair, content-addressed scheduler for bounded model turns.

    Each caller submits one segment, then waits before submitting the next.
    This yields the model after every segment, while interactive work always
    sorts before background artifact work. Identical segments share both the
    in-flight inference and the completed PCM cache.
    """

    def __init__(
        self,
        runtime: VieneuRuntime,
        cache: AudioCache,
        *,
        workers: int,
        model_revision: str,
    ):
        self.runtime = runtime
        self.cache = cache
        self.workers = workers
        self.model_revision = model_revision
        self._queue: queue.PriorityQueue[tuple[int, int, _SegmentJob | None]] = (
            queue.PriorityQueue()
        )
        self._sequence = itertools.count()
        self._inflight: dict[str, _SegmentState] = {}
        self._guard = threading.Lock()
        self._threads: list[threading.Thread] = []
        self._started = False

    def start(self) -> None:
        with self._guard:
            if self._started:
                return
            self._started = True
            for index in range(self.workers):
                thread = threading.Thread(
                    target=self._worker,
                    name=f"tts-segment-worker-{index}",
                    daemon=True,
                )
                self._threads.append(thread)
                thread.start()

    @property
    def queue_size(self) -> int:
        return self._queue.qsize()

    def close(self) -> None:
        with self._guard:
            if not self._started:
                return
            self._started = False
            threads = list(self._threads)
            self._threads.clear()
        for _ in threads:
            self._queue.put((1000, next(self._sequence), None))
        for thread in threads:
            thread.join(timeout=10)

    def segment_key(self, *, text: str, voice_id: str, style: str) -> str:
        text_hash = hashlib.sha256(text.encode("utf-8")).hexdigest()
        payload = ":".join(
            [
                self.model_revision,
                self.runtime.settings.backend,
                self.runtime.settings.precision,
                text_hash,
                voice_id,
                style,
                f"pcm16-{self.runtime.sample_rate}-mono",
                "watermark-v1",
            ]
        )
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()

    def generate(
        self,
        *,
        text: str,
        voice_id: str,
        style: str,
        priority: GenerationPriority,
    ) -> Path:
        cached, state = self._submit(
            text=text, voice_id=voice_id, style=style, priority=priority
        )
        if cached is not None:
            return cached
        assert state is not None
        return state.future.result()

    def stream(self, *, text: str, voice_id: str, style: str) -> Iterator[bytes]:
        cached, state = self._submit(
            text=text,
            voice_id=voice_id,
            style=style,
            priority=GenerationPriority.INTERACTIVE,
        )
        if cached is not None:
            return _read_chunks(cached)
        assert state is not None
        return state.tail()

    def _submit(
        self,
        *,
        text: str,
        voice_id: str,
        style: str,
        priority: GenerationPriority,
    ) -> tuple[Path | None, _SegmentState | None]:
        if not self._started:
            raise RuntimeError("Segment scheduler is not running.")
        key = self.segment_key(text=text, voice_id=voice_id, style=style)
        cached = self.cache.get(key, ".pcm")
        if cached is not None:
            return cached, None

        with self._guard:
            cached = self.cache.get(key, ".pcm")
            if cached is not None:
                return cached, None
            state = self._inflight.get(key)
            if state is None:
                temporary = self.cache.temporary_path(key, ".pcm.part")
                # A reader may attach before its queue worker starts.
                temporary.touch(exist_ok=False)
                state = _SegmentState(
                    key=key,
                    temporary=temporary,
                    future=Future(),
                )
                self._inflight[key] = state
                job = _SegmentJob(
                    key=key,
                    text=text,
                    voice_id=voice_id,
                    style=style,
                    interactive=priority == GenerationPriority.INTERACTIVE,
                    state=state,
                )
                self._queue.put((int(priority), next(self._sequence), job))
        return None, state

    def _worker(self) -> None:
        while True:
            _, _, job = self._queue.get()
            try:
                if job is None:
                    return
                self._run(job)
            finally:
                self._queue.task_done()

    def _run(self, job: _SegmentJob) -> None:
        started_at = time.perf_counter()
        temporary = job.state.temporary
        first_audio_at = None
        samples = 0
        try:
            with open(temporary, "wb") as output:
                for chunk in self.runtime.infer_chunks(
                    job.text,
                    voice_id=job.voice_id,
                    style=job.style,
                    interactive=job.interactive,
                ):
                    pcm = pcm16(chunk)
                    if not pcm:
                        continue
                    if first_audio_at is None:
                        first_audio_at = time.perf_counter()
                    output.write(pcm)
                    output.flush()
                    samples += len(pcm) // 2
                    job.state.publish(output.tell())
            path = self.cache.commit(temporary, job.key, ".pcm")
            job.state.finish(failed=False, final_path=path)
            job.state.future.set_result(path)
        except BaseException as error:
            self.cache.abort(temporary)
            job.state.finish(failed=True)
            job.state.future.set_exception(error)
            logger.exception(
                "speech_segment_failed key=%s voice_id=%s style=%s",
                job.key[:12],
                job.voice_id,
                job.style,
            )
        finally:
            with self._guard:
                if self._inflight.get(job.key) is job.state:
                    self._inflight.pop(job.key, None)
            elapsed = time.perf_counter() - started_at
            audio_seconds = samples / self.runtime.sample_rate
            logger.info(
                "speech_segment_complete key=%s priority=%s chars=%d "
                "ttfa_ms=%.0f rtf=%.3f audio_seconds=%.2f",
                job.key[:12],
                "interactive" if job.interactive else "background",
                len(job.text),
                (first_audio_at - started_at) * 1000 if first_audio_at else -1,
                elapsed / audio_seconds if audio_seconds else 0,
                audio_seconds,
            )


def pcm16(chunk: np.ndarray) -> bytes:
    audio = np.nan_to_num(np.asarray(chunk, dtype=np.float32), copy=False)
    audio = audio.reshape(-1)
    return (audio * 32767).clip(-32768, 32767).astype("<i2").tobytes()


def _read_chunks(path: Path, chunk_size: int = 64 * 1024) -> Iterator[bytes]:
    with open(path, "rb") as source:
        while chunk := source.read(chunk_size):
            yield chunk
