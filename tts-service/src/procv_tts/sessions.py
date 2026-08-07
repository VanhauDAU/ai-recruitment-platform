from __future__ import annotations

import secrets
import threading
import time
from dataclasses import dataclass


@dataclass(frozen=True)
class SpeechSession:
    text: str
    voice_id: str
    style: str
    artifact_key: str
    artifact_policy: str
    expires_at: float


class SpeechSessionStore:
    def __init__(self, ttl_seconds: int, max_items: int):
        self.ttl_seconds = ttl_seconds
        self.max_items = max_items
        self._items: dict[str, SpeechSession] = {}
        self._lock = threading.Lock()

    def create(
        self,
        *,
        text: str,
        voice_id: str,
        style: str,
        artifact_key: str,
        artifact_policy: str,
    ) -> tuple[str, SpeechSession]:
        now = time.time()
        token = secrets.token_urlsafe(32)
        session = SpeechSession(
            text=text,
            voice_id=voice_id,
            style=style,
            artifact_key=artifact_key,
            artifact_policy=artifact_policy,
            expires_at=now + self.ttl_seconds,
        )
        with self._lock:
            self._purge_locked(now)
            while len(self._items) >= self.max_items:
                self._items.pop(next(iter(self._items)))
            self._items[token] = session
        return token, session

    def get(self, token: str) -> SpeechSession | None:
        now = time.time()
        with self._lock:
            self._purge_locked(now)
            return self._items.get(token)

    def _purge_locked(self, now: float) -> None:
        expired = [
            token for token, item in self._items.items() if item.expires_at <= now
        ]
        for token in expired:
            self._items.pop(token, None)
