from contextlib import closing
from tempfile import SpooledTemporaryFile

from django.core.files import File

from common.r2_storage import public_media_storage

from .client import tts_service_client

MAX_SPEECH_ARTIFACT_BYTES = 128 * 1024 * 1024
SPOOL_IN_MEMORY_BYTES = 8 * 1024 * 1024
STORAGE_PREFIX = 'speech/artifacts/v2'


class SpeechArtifactStorageError(RuntimeError):
    """The generated artifact could not be verified or persisted durably."""


def _storage_key(artifact_key):
    return f'{STORAGE_PREFIX}/{artifact_key}.mp3'


def persist_tts_speech_artifact(result):
    """Copy one completed TTS MP3 to public storage without buffering it all in RAM."""
    artifact_key = result['artifact_key']
    expected_size = result['size_bytes']
    key = _storage_key(artifact_key)
    storage = public_media_storage()
    if storage.exists(key):
        return key

    downloaded = 0
    with (
        closing(tts_service_client.open_asset(artifact_key)) as response,
        SpooledTemporaryFile(max_size=SPOOL_IN_MEMORY_BYTES, mode='w+b') as temporary,
    ):
        for chunk in response.iter_content(chunk_size=1024 * 1024):
            if not chunk:
                continue
            downloaded += len(chunk)
            if downloaded > MAX_SPEECH_ARTIFACT_BYTES:
                raise SpeechArtifactStorageError('speech_artifact_too_large')
            temporary.write(chunk)
        if downloaded <= 0 or downloaded != expected_size:
            raise SpeechArtifactStorageError('speech_artifact_size_mismatch')
        temporary.seek(0)
        saved_key = storage.save(key, File(temporary, name=f'{artifact_key}.mp3'))

    return saved_key
