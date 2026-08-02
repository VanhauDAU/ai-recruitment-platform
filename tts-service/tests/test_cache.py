import os
import time

from procv_tts.cache import ORPHAN_PART_TTL_SECONDS, AudioCache


def test_prune_removes_only_stale_partial_files(tmp_path):
    cache = AudioCache(tmp_path, max_bytes=1024, ttl_seconds=3600)
    stale = tmp_path / ".stale.1.pcm.part"
    active = tmp_path / ".active.1.pcm.part"
    stale.write_bytes(b"stale")
    active.write_bytes(b"active")
    old = time.time() - ORPHAN_PART_TTL_SECONDS - 1
    os.utime(stale, (old, old))

    cache.prune(force=True)

    assert not stale.exists()
    assert active.exists()


def test_prune_enforces_ttl_and_size_for_committed_audio(tmp_path):
    cache = AudioCache(tmp_path, max_bytes=5, ttl_seconds=3600)
    oldest = tmp_path / "oldest.pcm"
    newest = tmp_path / "newest.mp3"
    oldest.write_bytes(b"1234")
    newest.write_bytes(b"5678")
    old = time.time() - 10
    os.utime(oldest, (old, old))

    cache.prune(force=True)

    assert not oldest.exists()
    assert newest.exists()
