from __future__ import annotations

import hashlib
import json

ARTIFACT_SCHEMA_VERSION = "speech-artifact-v2"
SEGMENTATION_VERSION = "semantic-segments-v1"
PCM_FORMAT_VERSION = "pcm-s16le-mono-v1"
MP3_FORMAT_VERSION = "mp3-cbr-96k-mono-v1"
WATERMARK_VERSION = "watermark-v1"


def text_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def artifact_identity(
    *,
    text_digest: str,
    source_revision: str,
    voice_id: str,
    style: str,
    model_source: str,
    model_revision: str,
    backend: str,
    precision: str,
    sample_rate: int,
    text_normalizer: str,
) -> tuple[str, str]:
    """Return an immutable artifact key and its model/config fingerprint.

    The artifact key intentionally includes source revision even when the
    normalized text did not change. This makes editorial revisions explicit
    and prevents a stale narration from being attached to a newer source.
    """
    config = {
        "artifact_schema": ARTIFACT_SCHEMA_VERSION,
        "backend": backend,
        "model_revision": model_revision,
        "model_source": model_source,
        "mp3_format": MP3_FORMAT_VERSION,
        "pcm_format": PCM_FORMAT_VERSION,
        "precision": precision,
        "sample_rate": sample_rate,
        "segmentation": SEGMENTATION_VERSION,
        "text_normalizer": text_normalizer,
        "watermark": WATERMARK_VERSION,
    }
    config_json = json.dumps(
        config, ensure_ascii=True, separators=(",", ":"), sort_keys=True
    )
    config_hash = hashlib.sha256(config_json.encode("utf-8")).hexdigest()
    identity = {
        "config_hash": config_hash,
        "source_revision": source_revision,
        "style": style,
        "text_hash": text_digest,
        "voice_id": voice_id,
    }
    payload = json.dumps(
        identity, ensure_ascii=True, separators=(",", ":"), sort_keys=True
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest(), config_hash
