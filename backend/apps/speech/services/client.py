from __future__ import annotations

import re

import requests
from django.conf import settings
from django.core.cache import cache

CAPABILITIES_CACHE_KEY = 'speech:tts-capabilities:v1'
STREAM_PATH_PATTERN = re.compile(r'^/tts/v1/streams/[A-Za-z0-9_-]{20,128}$')
ASSET_PATH_PATTERN = re.compile(r'^/tts/v1/assets/[0-9a-f]{64}\.mp3$')


class SpeechServiceUnavailable(Exception):
    """The private synthesis service cannot accept work right now."""


class SpeechServiceRejected(Exception):
    """The synthesis service rejected a validated application request."""


class TtsServiceClient:
    def __init__(self):
        self.session = requests.Session()

    @property
    def base_url(self):
        return settings.SPEECH_TTS_BASE_URL.rstrip('/')

    @property
    def timeout(self):
        return (
            settings.SPEECH_TTS_CONNECT_TIMEOUT_SECONDS,
            settings.SPEECH_TTS_READ_TIMEOUT_SECONDS,
        )

    @property
    def artifact_timeout(self):
        return (
            settings.SPEECH_TTS_CONNECT_TIMEOUT_SECONDS,
            settings.SPEECH_ARTIFACT_DOWNLOAD_TIMEOUT_SECONDS,
        )

    @property
    def headers(self):
        return {'X-TTS-Internal-Token': settings.SPEECH_TTS_INTERNAL_TOKEN}

    def _request(self, method, path, *, json=None, timeout=None):
        try:
            response = self.session.request(
                method,
                f'{self.base_url}{path}',
                json=json,
                headers=self.headers,
                timeout=timeout or self.timeout,
            )
        except requests.RequestException as error:
            raise SpeechServiceUnavailable from error

        if response.status_code >= 500:
            raise SpeechServiceUnavailable
        if response.status_code >= 400:
            raise SpeechServiceRejected
        try:
            data = response.json()
        except ValueError as error:
            raise SpeechServiceUnavailable from error
        if not isinstance(data, dict):
            raise SpeechServiceUnavailable
        return data

    def capabilities(self):
        cached = cache.get(CAPABILITIES_CACHE_KEY)
        if cached is not None:
            return cached
        data = self._request('GET', '/internal/v1/capabilities')
        voices = data.get('voices')
        styles = data.get('styles')
        default_voice_id = data.get('default_voice_id')
        if not isinstance(voices, list) or not voices or not isinstance(styles, list):
            raise SpeechServiceUnavailable
        voice_ids = {voice.get('id') for voice in voices if isinstance(voice, dict)}
        if default_voice_id not in voice_ids:
            raise SpeechServiceUnavailable
        cache.set(CAPABILITIES_CACHE_KEY, data, settings.SPEECH_CAPABILITIES_CACHE_SECONDS)
        return data

    def create_session(
        self,
        *,
        text,
        voice_id,
        style,
        text_hash,
        normalizer_version,
        source_revision,
    ):
        data = self._request(
            'POST',
            '/internal/v1/sessions',
            json={
                'text': text,
                'voice_id': voice_id,
                'style': style,
                'text_hash': text_hash,
                'normalizer_version': normalizer_version,
                'source_revision': source_revision,
            },
        )
        stream_path = data.get('stream_path', '')
        artifact_key = data.get('artifact_key', '')
        config_hash = data.get('config_hash', '')
        model_revision = data.get('model_revision', '')
        if (
            not isinstance(stream_path, str)
            or not STREAM_PATH_PATTERN.fullmatch(stream_path)
            or not isinstance(artifact_key, str)
            or not re.fullmatch(r'[0-9a-f]{64}', artifact_key)
            or not isinstance(config_hash, str)
            or not re.fullmatch(r'[0-9a-f]{64}', config_hash)
            or model_revision != settings.SPEECH_MODEL_REVISION
        ):
            raise SpeechServiceUnavailable
        return {
            'stream_url': stream_path,
            'artifact_key': artifact_key,
            'artifact_status': data.get('artifact_status', 'MISSING'),
            'config_hash': config_hash,
            'model_revision': model_revision,
            'expires_at': data.get('expires_at'),
            'cached': bool(data.get('cached')),
            'sample_rate': data.get('sample_rate', 48_000),
        }

    def artifact_status(self, artifact_key):
        if not isinstance(artifact_key, str) or not re.fullmatch(r'[0-9a-f]{64}', artifact_key):
            raise SpeechServiceRejected
        data = self._request('GET', f'/internal/v1/artifacts/{artifact_key}')
        artifact_status = data.get('status')
        if artifact_status in {'MISSING', 'GENERATING', 'FAILED'}:
            return {
                'artifact_key': artifact_key,
                'error_code': data.get('error_code', ''),
                'status': artifact_status,
            }
        if artifact_status != 'READY':
            raise SpeechServiceUnavailable
        asset_url = data.get('asset_url', '')
        mime_type = data.get('mime_type', '')
        duration_ms = data.get('duration_ms')
        size_bytes = data.get('size_bytes')
        valid_duration = (
            isinstance(duration_ms, int) and not isinstance(duration_ms, bool) and duration_ms > 0
        )
        valid_size = (
            isinstance(size_bytes, int) and not isinstance(size_bytes, bool) and size_bytes > 0
        )
        if (
            not isinstance(asset_url, str)
            or not ASSET_PATH_PATTERN.fullmatch(asset_url)
            or asset_url != f'/tts/v1/assets/{artifact_key}.mp3'
            or mime_type != 'audio/mpeg'
            or not valid_duration
            or not valid_size
        ):
            raise SpeechServiceUnavailable
        return {
            'artifact_key': artifact_key,
            'asset_url': asset_url,
            'mime_type': mime_type,
            'duration_ms': duration_ms,
            'size_bytes': size_bytes,
            'sample_rate': data.get('sample_rate', 48_000),
            'status': 'READY',
        }

    def open_asset(self, artifact_key):
        """Open a validated TTS-local MP3 for streaming into durable storage."""
        asset_url = f'/tts/v1/assets/{artifact_key}.mp3'
        if not isinstance(artifact_key, str) or not ASSET_PATH_PATTERN.fullmatch(asset_url):
            raise SpeechServiceRejected
        try:
            response = self.session.get(
                f'{self.base_url}{asset_url}',
                headers=self.headers,
                timeout=self.artifact_timeout,
                stream=True,
            )
        except requests.RequestException as error:
            raise SpeechServiceUnavailable from error
        if response.status_code >= 500:
            response.close()
            raise SpeechServiceUnavailable
        if response.status_code >= 400:
            response.close()
            raise SpeechServiceRejected
        content_type = response.headers.get('Content-Type', '').partition(';')[0].strip().lower()
        if content_type != 'audio/mpeg':
            response.close()
            raise SpeechServiceUnavailable
        return response


tts_service_client = TtsServiceClient()
