from types import SimpleNamespace
from unittest.mock import patch

from django.test import SimpleTestCase, override_settings

from apps.speech.services.speech import create_blog_post_speech_session

CATALOG = {
    'default_voice_id': 'north-male-natural',
    'voices': [
        {
            'id': 'north-male-natural',
            'default_style': 'tu_nhien',
        }
    ],
    'styles': [{'id': 'tu_nhien'}],
}


@override_settings(SPEECH_MAX_TEXT_CHARS=5000)
class SpeechServiceTests(SimpleTestCase):
    @patch('apps.speech.services.speech.register_blog_speech_generation')
    @patch('apps.speech.services.speech.tts_service_client.create_session')
    @patch('apps.speech.services.speech.get_speech_catalog', return_value=CATALOG)
    def test_resolves_server_defaults_for_one_click_playback(
        self,
        _catalog,
        create_session,
        register,
    ):
        create_session.return_value = {
            'artifact_key': 'a' * 64,
            'config_hash': 'b' * 64,
            'model_revision': 'vieneu-3.2.3-v3-turbo-int8',
            'stream_url': '/tts/v1/streams/opaque-token-value-123456',
            'cached': False,
        }
        post = SimpleNamespace(
            public_id='ps_test',
            edit_revision=7,
            title='Bài viết',
            content='<p>Nội dung.</p>',
        )

        result = create_blog_post_speech_session(
            post=post,
            voice_id='',
            style='',
        )

        self.assertEqual(result['voice_id'], 'north-male-natural')
        self.assertEqual(result['style'], 'tu_nhien')
        create_session.assert_called_once()
        payload = create_session.call_args.kwargs
        self.assertEqual(payload['text'], 'Bài viết.\n\nNội dung.')
        self.assertEqual(payload['voice_id'], 'north-male-natural')
        self.assertEqual(payload['style'], 'tu_nhien')
        self.assertEqual(len(payload['text_hash']), 64)
        self.assertEqual(payload['normalizer_version'], 'blog-speech-v1')
        self.assertEqual(payload['source_revision'], 'blog.post:ps_test:r7')
        register.assert_called_once_with(
            post=post,
            session=create_session.return_value,
            text_hash=payload['text_hash'],
            voice_id='north-male-natural',
            style='tu_nhien',
        )
