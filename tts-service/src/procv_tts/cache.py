from __future__ import annotations

import json
import os
import shutil
import threading
import time
import weakref
from pathlib import Path

PRUNE_INTERVAL_SECONDS = 60.0
ORPHAN_PART_TTL_SECONDS = 60 * 60


class AudioCache:
    def __init__(
        self,
        root: Path,
        *,
        max_bytes: int,
        ttl_by_suffix: dict[str, int],
    ):
        self.root = root
        self.max_bytes = max_bytes
        self.ttl_by_suffix = ttl_by_suffix
        self.root.mkdir(parents=True, exist_ok=True)
        self._locks: weakref.WeakValueDictionary[str, threading.Lock] = (
            weakref.WeakValueDictionary()
        )
        self._locks_guard = threading.Lock()
        self._prune_guard = threading.Lock()
        self._prune_running = False
        self._last_prune = 0.0

    def path(self, key: str, suffix: str = ".wav") -> Path:
        return self.root / f"{key}{suffix}"

    def get(self, key: str, suffix: str = ".wav") -> Path | None:
        path = self.path(key, suffix)
        if not path.is_file():
            return None
        try:
            if time.time() - path.stat().st_mtime > self._ttl_for(path):
                path.unlink(missing_ok=True)
                return None
            os.utime(path, None)
        except OSError:
            return None
        return path

    def temporary_path(self, key: str, suffix: str = ".part") -> Path:
        return self.root / (f".{key}.{os.getpid()}.{threading.get_ident()}{suffix}")

    def commit(self, temporary: Path, key: str, suffix: str = ".wav") -> Path:
        target = self.path(key, suffix)
        os.replace(temporary, target)
        self.schedule_prune()
        return target

    def commit_pcm(self, temporary: Path, key: str, header: bytes) -> Path:
        """Ghép header WAV hoàn chỉnh vào trước file PCM thô rồi commit."""
        staged = temporary.with_suffix(".wav.part")
        with open(temporary, "rb") as source, open(staged, "wb") as target:
            target.write(header)
            shutil.copyfileobj(source, target)
        temporary.unlink(missing_ok=True)
        return self.commit(staged, key)

    def metadata_path(self, key: str) -> Path:
        return self.path(key, ".meta.json")

    def get_metadata(self, key: str) -> dict | None:
        path = self.get(key, ".meta.json")
        if path is None:
            return None
        try:
            with open(path, encoding="utf-8") as source:
                value = json.load(source)
        except (OSError, ValueError, TypeError):
            path.unlink(missing_ok=True)
            return None
        return value if isinstance(value, dict) else None

    def commit_metadata(self, key: str, value: dict) -> Path:
        temporary = self.temporary_path(key, ".meta.json.part")
        with open(temporary, "w", encoding="utf-8") as target:
            json.dump(value, target, separators=(",", ":"), sort_keys=True)
        return self.commit(temporary, key, ".meta.json")

    @staticmethod
    def abort(temporary: Path) -> None:
        temporary.unlink(missing_ok=True)

    def lock_for(self, key: str) -> threading.Lock:
        with self._locks_guard:
            return self._locks.setdefault(key, threading.Lock())

    def schedule_prune(self) -> None:
        """Run bounded cache maintenance off the audio generation path."""
        with self._prune_guard:
            now = time.monotonic()
            if self._prune_running or now - self._last_prune < PRUNE_INTERVAL_SECONDS:
                return
            self._prune_running = True
            self._last_prune = now
        threading.Thread(
            target=self._prune_files,
            name="tts-cache-prune",
            daemon=True,
        ).start()

    def prune(self, *, force: bool = False) -> None:
        """Synchronously prune, used once during startup and by tests."""
        with self._prune_guard:
            now = time.monotonic()
            if self._prune_running:
                return
            if not force and now - self._last_prune < PRUNE_INTERVAL_SECONDS:
                return
            self._prune_running = True
            self._last_prune = now
        self._prune_files()

    def _prune_files(self) -> None:
        try:
            self._prune_files_unlocked()
        finally:
            with self._prune_guard:
                self._prune_running = False

    def _prune_files_unlocked(self) -> None:
        now = time.time()
        files = []
        total = 0
        supported_suffixes = {".wav", ".pcm", ".mp3", ".json"}
        for path in self.root.iterdir():
            if not path.is_file():
                continue
            try:
                stat = path.stat()
            except OSError:
                continue
            # Atomic commits use hidden *.part files. A hard kill may leave one
            # behind; never touch an active generation, but remove stale parts
            # so an interrupted long article cannot leak disk forever.
            if path.suffix == ".part":
                if now - stat.st_mtime > ORPHAN_PART_TTL_SECONDS:
                    path.unlink(missing_ok=True)
                continue
            if path.suffix not in supported_suffixes:
                continue
            if now - stat.st_mtime > self._ttl_for(path):
                path.unlink(missing_ok=True)
                continue
            files.append((stat.st_mtime, stat.st_size, path))
            total += stat.st_size

        if total <= self.max_bytes:
            return
        for _, size, path in sorted(files):
            path.unlink(missing_ok=True)
            total -= size
            if total <= self.max_bytes:
                break

    def stats(self) -> dict[str, int]:
        files = 0
        size_bytes = 0
        try:
            paths = tuple(self.root.iterdir())
        except OSError:
            return {"files": 0, "size_bytes": 0}
        for path in paths:
            if not path.is_file() or path.suffix == ".part":
                continue
            try:
                size_bytes += path.stat().st_size
            except OSError:
                continue
            files += 1
        return {"files": files, "size_bytes": size_bytes}

    def _ttl_for(self, path: Path) -> int:
        name = path.name
        if name.endswith(".meta.json"):
            return self.ttl_by_suffix[".meta.json"]
        return self.ttl_by_suffix.get(path.suffix, self.ttl_by_suffix[".wav"])
