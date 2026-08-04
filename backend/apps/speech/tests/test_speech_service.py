from types import SimpleNamespace
from unittest.mock import patch

from django.test import SimpleTestCase, override_settings

from apps.speech.services.client import SpeechServiceRejected
from apps.speech.services.speech import (
    create_blog_post_speech_session,
    create_text_speech_session,
)

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


@override_settings(SPEECH_MAX_TEXT_CHARS=5000, SPEECH_MAX_ADHOC_TEXT_CHARS=600)
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

    @patch('apps.speech.services.speech.register_blog_speech_generation')
    @patch('apps.speech.services.speech.tts_service_client.create_session')
    @patch('apps.speech.services.speech.get_speech_catalog', return_value=CATALOG)
    def test_ad_hoc_text_reuses_one_cache_identity_and_stays_undurable(
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

        result = create_text_speech_session(
            text='<b>Chào bạn</b>\nTôi tìm được ba việc phù hợp',
            voice_id='',
            style='',
        )

        self.assertEqual(result['voice_id'], 'north-male-natural')
        payload = create_session.call_args.kwargs
        self.assertEqual(payload['text'], 'Chào bạn.\n\nTôi tìm được ba việc phù hợp.')
        self.assertEqual(payload['normalizer_version'], 'plain-speech-v1')
        # A constant source revision keeps the same sentence on one cache entry
        # no matter which surface asked for it.
        self.assertEqual(payload['source_revision'], 'text:v1')
        register.assert_not_called()

    @patch('apps.speech.services.speech.tts_service_client.create_session')
    @patch('apps.speech.services.speech.get_speech_catalog', return_value=CATALOG)
    def test_text_that_normalizes_to_nothing_never_reaches_the_engine(
        self,
        _catalog,
        create_session,
    ):
        with self.assertRaises(SpeechServiceRejected):
            create_text_speech_session(text='<script>alert(1)</script>', voice_id='', style='')

        create_session.assert_not_called()
