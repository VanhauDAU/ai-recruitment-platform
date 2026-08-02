from __future__ import annotations

import threading
import time
from types import SimpleNamespace

import numpy as np

from procv_tts.cache import AudioCache
from procv_tts.scheduler import GenerationPriority, SegmentScheduler
from procv_tts.segmentation import split_for_speech


class ControlledRuntime:
    sample_rate = 100

    def __init__(self):
        self.settings = SimpleNamespace(backend="onnx", precision="int8")
        self.calls = []
        self.calls_guard = threading.Lock()
        self.first_started = threading.Event()
        self.release_first = threading.Event()

    def infer_chunks(self, text, **_kwargs):
        with self.calls_guard:
            self.calls.append(text)
        if text == "background-one":
            self.first_started.set()
            assert self.release_first.wait(2)
        yield np.full(20, 0.1, dtype=np.float32)


def scheduler(runtime, tmp_path):
    cache = AudioCache(tmp_path, max_bytes=10_000_000, ttl_seconds=3600)
    value = SegmentScheduler(runtime, cache, workers=1, model_revision="test-model")
    value.start()
    return value


def test_semantic_split_is_bounded():
    text = " ".join(
        f"Đây là câu số {index}, dùng để kiểm tra ranh giới ngữ nghĩa."
        for index in range(30)
    )
    segments = split_for_speech(text)
    assert len(segments) > 1
    assert all(1 <= len(segment) <= 240 for segment in segments)
    assert all(segment.endswith(".") for segment in segments[:-1])
    assert "".join(segments).replace(" ", "") == text.replace(" ", "")


def test_interactive_segment_overtakes_queued_background(tmp_path):
    runtime = ControlledRuntime()
    queue = scheduler(runtime, tmp_path)
    completed = []

    def generate(text, priority):
        queue.generate(
            text=text,
            voice_id="north-male-natural",
            style="tu_nhien",
            priority=priority,
        )
        completed.append(text)

    first = threading.Thread(
        target=generate,
        args=("background-one", GenerationPriority.BACKGROUND),
    )
    second = threading.Thread(
        target=generate,
        args=("background-two", GenerationPriority.BACKGROUND),
    )
    interactive = threading.Thread(
        target=generate,
        args=("interactive", GenerationPriority.INTERACTIVE),
    )
    try:
        first.start()
        assert runtime.first_started.wait(1)
        second.start()
        interactive.start()
        time.sleep(0.02)
        runtime.release_first.set()
        for thread in (first, second, interactive):
            thread.join(2)
        assert runtime.calls == ["background-one", "interactive", "background-two"]
        assert sorted(completed) == ["background-one", "background-two", "interactive"]
    finally:
        runtime.release_first.set()
        queue.close()


def test_same_segment_singleflight_cache_and_disconnect_survival(tmp_path):
    runtime = ControlledRuntime()
    queue = scheduler(runtime, tmp_path)
    results = []

    def generate():
        results.append(
            queue.generate(
                text="background-one",
                voice_id="north-male-natural",
                style="tu_nhien",
                priority=GenerationPriority.INTERACTIVE,
            )
        )

    first = threading.Thread(target=generate)
    second = threading.Thread(target=generate)
    try:
        first.start()
        assert runtime.first_started.wait(1)
        second.start()

        # A streaming reader may disconnect, but its shared inference continues
        # and both synchronous waiters receive the same committed PCM.
        reader = queue.stream(
            text="background-one",
            voice_id="north-male-natural",
            style="tu_nhien",
        )
        runtime.release_first.set()
        assert next(reader)
        reader.close()
        first.join(2)
        second.join(2)

        assert len(results) == 2
        assert results[0] == results[1]
        assert runtime.calls == ["background-one"]
        cached = queue.generate(
            text="background-one",
            voice_id="north-male-natural",
            style="tu_nhien",
            priority=GenerationPriority.INTERACTIVE,
        )
        assert cached == results[0]
        assert runtime.calls == ["background-one"]
    finally:
        runtime.release_first.set()
        queue.close()
