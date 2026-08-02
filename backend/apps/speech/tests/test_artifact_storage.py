from unittest.mock import Mock, patch

from django.test import SimpleTestCase

from apps.speech.services.artifacts import (
    SpeechArtifactStorageError,
    persist_tts_speech_artifact,
)


class SpeechArtifactStorageTests(SimpleTestCase):
    def setUp(self):
        self.result = {
            'artifact_key': 'a' * 64,
            'asset_url': f'/tts/v1/assets/{"a" * 64}.mp3',
            'size_bytes': 6,
        }

    @patch('apps.speech.services.artifacts.tts_service_client.open_asset')
    @patch('apps.speech.services.artifacts.public_media_storage')
    def test_streams_the_completed_mp3_to_public_storage(self, storage_factory, open_asset):
        response = Mock()
        response.iter_content.return_value = [b'abc', b'def']
        storage = storage_factory.return_value
        storage.exists.return_value = False
        storage.save.return_value = f'speech/artifacts/v2/{"a" * 64}.mp3'
        open_asset.return_value = response

        key = persist_tts_speech_artifact(self.result)

        self.assertEqual(key, f'speech/artifacts/v2/{"a" * 64}.mp3')
        open_asset.assert_called_once_with('a' * 64)
        storage.save.assert_called_once()
        self.assertEqual(storage.save.call_args.args[0], key)
        response.close.assert_called_once()

    @patch('apps.speech.services.artifacts.tts_service_client.open_asset')
    @patch('apps.speech.services.artifacts.public_media_storage')
    def test_rejects_a_truncated_download(self, storage_factory, open_asset):
        response = Mock()
        response.iter_content.return_value = [b'abc']
        storage_factory.return_value.exists.return_value = False
        open_asset.return_value = response

        with self.assertRaises(SpeechArtifactStorageError):
            persist_tts_speech_artifact(self.result)

        storage_factory.return_value.save.assert_not_called()
