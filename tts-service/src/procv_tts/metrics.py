from __future__ import annotations

import os
import resource
import threading
import time
from collections import deque


def _percentile(values: deque[float], percentile: float) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    index = min(len(ordered) - 1, round((len(ordered) - 1) * percentile))
    return round(ordered[index], 3)


class RuntimeMetrics:
    """Bounded, process-local operational telemetry without request payloads."""

    def __init__(self, sample_limit: int = 512):
        self.started_at = time.time()
        self._lock = threading.Lock()
        self._started = 0
        self._completed = 0
        self._failed = 0
        self._cache_hits = 0
        self._cache_misses = 0
        self._rejected = 0
        self._audio_seconds = 0.0
        self._ttfa_ms: deque[float] = deque(maxlen=sample_limit)
        self._rtf: deque[float] = deque(maxlen=sample_limit)
        self._queue_wait_ms: deque[float] = deque(maxlen=sample_limit)

    def cache_lookup(self, *, hit: bool) -> None:
        with self._lock:
            if hit:
                self._cache_hits += 1
            else:
                self._cache_misses += 1

    def generation_started(self) -> None:
        with self._lock:
            self._started += 1

    def generation_finished(
        self,
        *,
        completed: bool,
        audio_seconds: float,
        ttfa_ms: float | None,
        rtf: float | None,
        queue_wait_ms: float,
    ) -> None:
        with self._lock:
            if completed:
                self._completed += 1
            else:
                self._failed += 1
            self._audio_seconds += audio_seconds
            if ttfa_ms is not None:
                self._ttfa_ms.append(ttfa_ms)
            if rtf is not None:
                self._rtf.append(rtf)
            self._queue_wait_ms.append(queue_wait_ms)

    def rejected(self) -> None:
        with self._lock:
            self._rejected += 1

    def snapshot(self) -> dict:
        with self._lock:
            values = {
                "started": self._started,
                "completed": self._completed,
                "failed": self._failed,
                "cache_hits": self._cache_hits,
                "cache_misses": self._cache_misses,
                "rejected": self._rejected,
                "audio_seconds": round(self._audio_seconds, 3),
                "ttfa_ms_p95": _percentile(self._ttfa_ms, 0.95),
                "rtf_p95": _percentile(self._rtf, 0.95),
                "queue_wait_ms_p95": _percentile(self._queue_wait_ms, 0.95),
            }
        values.update(
            {
                "uptime_seconds": round(time.time() - self.started_at, 3),
                "process_cpu_seconds": round(time.process_time(), 3),
                "process_rss_bytes": _resident_bytes(),
            }
        )
        return values


def _resident_bytes() -> int:
    try:
        with open("/proc/self/statm", encoding="ascii") as source:
            pages = int(source.read().split()[1])
        return pages * os.sysconf("SC_PAGE_SIZE")
    except (OSError, ValueError, IndexError):
        value = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
        # Linux reports KiB; macOS reports bytes.
        return int(value if os.uname().sysname == "Darwin" else value * 1024)
