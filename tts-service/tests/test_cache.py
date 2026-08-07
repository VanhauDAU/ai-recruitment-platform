import os
import time

from procv_tts.cache import ORPHAN_PART_TTL_SECONDS, AudioCache


def audio_cache(tmp_path, *, max_bytes=1024):
    return AudioCache(
        tmp_path,
        max_bytes=max_bytes,
        ttl_by_suffix={
            ".pcm": 3600,
            ".wav": 7200,
            ".mp3": 10800,
            ".meta.json": 10800,
        },
    )


def test_prune_removes_only_stale_partial_files(tmp_path):
    cache = audio_cache(tmp_path)
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
    cache = audio_cache(tmp_path, max_bytes=5)
    oldest = tmp_path / "oldest.pcm"
    newest = tmp_path / "newest.mp3"
    oldest.write_bytes(b"1234")
    newest.write_bytes(b"5678")
    old = time.time() - 10
    os.utime(oldest, (old, old))

    cache.prune(force=True)

    assert not oldest.exists()
    assert newest.exists()


def test_cache_applies_ttl_by_artifact_type(tmp_path):
    cache = audio_cache(tmp_path)
    pcm = tmp_path / "segment.pcm"
    wav = tmp_path / "article.wav"
    pcm.write_bytes(b"pcm")
    wav.write_bytes(b"wav")
    old = time.time() - 4000
    os.utime(pcm, (old, old))
    os.utime(wav, (old, old))

    cache.prune(force=True)

    assert not pcm.exists()
    assert wav.exists()
