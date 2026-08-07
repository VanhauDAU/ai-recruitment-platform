from unittest.mock import patch

from django.conf import settings
from django.core.cache import cache
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIRequestFactory

from apps.blog.models import Post, PostCategory
from apps.speech.api.views.speech import SpeechSessionView
from apps.speech.services import SpeechFeatureDisabled, SpeechQuotaExceeded
from apps.speech.services.client import SpeechServiceUnavailable

CATALOG = {
    'default_voice_id': 'north-male-natural',
    'sample_rate': 48_000,
    'voices': [
        {
            'id': 'north-male-natural',
            'label': 'Phạm Tuyên',
            'gender': 'male',
            'region': 'Bắc',
            'default_style': 'tu_nhien',
        }
    ],
    'styles': [{'id': 'tu_nhien', 'label': 'Tự nhiên'}],
}


class SpeechApiTests(TestCase):
    def setUp(self):
        cache.clear()
        self.category = PostCategory.objects.create(name='Nghề nghiệp', slug='nghe-nghiep')
        self.post = Post.objects.create(
            title='Bài viết có giọng đọc',
            category=self.category,
            content='<h2>Mở đầu</h2><p>Nội dung công khai.</p>',
            status=Post.Status.PUBLISHED,
            published_at=timezone.now(),
        )

    @patch('apps.speech.api.views.speech.get_speech_catalog', return_value=CATALOG)
    def test_voice_catalog_is_public_and_cacheable(self, _catalog):
        response = self.client.get(reverse('speech-voice-catalog'))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['default_voice_id'], 'north-male-natural')
        self.assertEqual(response['Cache-Control'], 'private, max-age=60')

    @patch('apps.speech.api.views.speech.create_blog_post_speech_session')
    def test_creates_blog_speech_session_without_accepting_raw_text(self, create_session):
        create_session.return_value = {
            'stream_url': '/tts/v1/streams/opaque-token-value-123456',
            'expires_at': 123.0,
            'cached': False,
            'sample_rate': 48_000,
            'voice_id': 'north-male-natural',
            'style': 'tu_nhien',
            'truncated': False,
        }

        response = self.client.post(
            reverse('speech-session'),
            {
                'source_type': 'blog_post',
                'source_public_id': self.post.public_id,
                'voice_id': 'north-male-natural',
                'style': 'tu_nhien',
                'text': 'Nội dung client không được chuyển tiếp',
            },
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 201)
        create_session.assert_called_once_with(
            post=self.post,
            quota_subject='127.0.0.1',
            authenticated=False,
        )
        self.assertNotIn('text', response.data)
        self.assertEqual(response['Cache-Control'], 'no-store')

    @patch('apps.speech.api.views.speech.create_blog_post_speech_session')
    def test_uses_service_defaults_for_one_click_playback(self, create_session):
        create_session.return_value = {
            'stream_url': '/tts/v1/streams/opaque-token-value-123456',
            'voice_id': 'north-male-natural',
            'style': 'tu_nhien',
        }

        response = self.client.post(
            reverse('speech-session'),
            {
                'source_type': 'blog_post',
                'source_public_id': self.post.public_id,
            },
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 201)
        create_session.assert_called_once_with(
            post=self.post,
            quota_subject='127.0.0.1',
            authenticated=False,
        )

    @patch('apps.speech.api.views.speech.create_text_speech_session')
    def test_speaks_caller_supplied_text_without_a_source_record(self, create_session):
        create_session.return_value = {
            'stream_url': '/tts/v1/streams/opaque-token-value-123456',
            'voice_id': 'north-male-natural',
            'style': 'tu_nhien',
            'truncated': False,
        }

        response = self.client.post(
            reverse('speech-session'),
            {
                'source_type': 'text',
                'surface': 'chatbot',
                'text': 'Tôi tìm được ba việc phù hợp với bạn.',
            },
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 201)
        create_session.assert_called_once_with(
            text='Tôi tìm được ba việc phù hợp với bạn.',
            surface='chatbot',
            quota_subject='127.0.0.1',
            authenticated=False,
        )
        self.assertEqual(response['Cache-Control'], 'no-store')

    def test_rejects_blank_and_oversized_text(self):
        blank = self.client.post(
            reverse('speech-session'),
            {'source_type': 'text', 'text': '   '},
            content_type='application/json',
        )
        oversized = self.client.post(
            reverse('speech-session'),
            {'source_type': 'text', 'surface': 'chatbot', 'text': 'a' * 601},
            content_type='application/json',
        )

        self.assertEqual(blank.status_code, 400)
        self.assertEqual(oversized.status_code, 400)

    def test_text_requires_an_explicit_supported_surface(self):
        response = self.client.post(
            reverse('speech-session'),
            {'source_type': 'text', 'text': 'Xin chào.'},
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn('surface', response.data)

    def test_rejects_blog_source_without_a_post_id(self):
        response = self.client.post(
            reverse('speech-session'),
            {'source_type': 'blog_post'},
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn('source_public_id', response.data)

    @patch(
        'apps.speech.api.views.speech.create_text_speech_session',
        side_effect=SpeechFeatureDisabled,
    )
    def test_disabled_surface_fails_closed_without_blocking_text_ui(self, _create):
        response = self.client.post(
            reverse('speech-session'),
            {'source_type': 'text', 'surface': 'chatbot', 'text': 'Xin chào.'},
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.data['code'], 'speech_disabled')

    @patch(
        'apps.speech.api.views.speech.create_text_speech_session',
        side_effect=SpeechQuotaExceeded(3600),
    )
    def test_daily_quota_returns_retry_after(self, _create):
        response = self.client.post(
            reverse('speech-session'),
            {'source_type': 'text', 'surface': 'chatbot', 'text': 'Xin chào.'},
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 429)
        self.assertEqual(response.data['code'], 'speech_quota_exceeded')
        self.assertEqual(response['Retry-After'], '3600')

    def test_ad_hoc_text_cannot_exhaust_the_article_playback_budget(self):
        factory = APIRequestFactory()

        def scope_for(payload):
            view = SpeechSessionView()
            view.request = view.initialize_request(factory.post('/', payload, format='json'))
            view.get_throttles()
            return view.throttle_scope

        rates = settings.REST_FRAMEWORK['DEFAULT_THROTTLE_RATES']
        self.assertEqual(scope_for({'source_type': 'text', 'text': 'Xin chào.'}), 'speech_adhoc')
        self.assertEqual(
            scope_for({'source_type': 'blog_post', 'source_public_id': self.post.public_id}),
            'speech_session',
        )
        # A missing rate is an ImproperlyConfigured 500 on the first request.
        self.assertIn('speech_adhoc', rates)
        self.assertIn('speech_session', rates)

    @patch(
        'apps.speech.api.views.speech.get_speech_catalog',
        side_effect=SpeechServiceUnavailable,
    )
    def test_unavailable_service_fails_without_affecting_blog_api(self, _catalog):
        unavailable = self.client.get(reverse('speech-voice-catalog'))
        article = self.client.get(reverse('blog-post-detail', args=[self.post.slug]))

        self.assertEqual(unavailable.status_code, 503)
        self.assertEqual(unavailable.data['code'], 'speech_unavailable')
        self.assertEqual(article.status_code, 200)
