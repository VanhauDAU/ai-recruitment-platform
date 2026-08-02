from unittest.mock import patch

from django.core.cache import cache
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone

from apps.blog.models import Post, PostCategory
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
            voice_id='north-male-natural',
            style='tu_nhien',
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
        create_session.assert_called_once_with(post=self.post, voice_id='', style='')

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
