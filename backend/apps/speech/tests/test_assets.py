from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from unittest.mock import Mock, patch

from django.db import close_old_connections, transaction
from django.test import SimpleTestCase, TestCase, TransactionTestCase, override_settings
from django.utils import timezone

from apps.blog.models import Post, PostCategory
from apps.blog.services import publish_post
from apps.speech.models import BlogSpeechAsset
from apps.speech.services import register_blog_speech_generation
from apps.speech.services.client import SpeechServiceUnavailable, TtsServiceClient
from apps.speech.tasks import (
    finalize_blog_speech_asset,
    purge_obsolete_speech_artifacts,
    reconcile_speech_artifacts,
)

ARTIFACT_KEY = 'a' * 64
CONFIG_HASH = 'b' * 64
SESSION = {
    'artifact_key': ARTIFACT_KEY,
    'config_hash': CONFIG_HASH,
    'model_revision': 'vieneu-3.2.3-v3-turbo-int8',
}
READY_RESULT = {
    'artifact_key': ARTIFACT_KEY,
    'asset_url': f'/tts/v1/assets/{ARTIFACT_KEY}.mp3',
    'mime_type': 'audio/mpeg',
    'duration_ms': 12_345,
    'size_bytes': 123_456,
    'sample_rate': 48_000,
    'status': 'READY',
}


@override_settings(
    SPEECH_TTS_BASE_URL='http://tts-test:8001',
    SPEECH_TTS_CONNECT_TIMEOUT_SECONDS=0.25,
    SPEECH_ARTIFACT_DOWNLOAD_TIMEOUT_SECONDS=321,
)
class TtsArtifactClientTests(SimpleTestCase):
    def test_reads_completed_live_artifact_status(self):
        response = Mock(status_code=200)
        response.json.return_value = READY_RESULT
        client = TtsServiceClient()

        with patch.object(client.session, 'request', return_value=response) as request:
            result = client.artifact_status(ARTIFACT_KEY)

        self.assertEqual(result, READY_RESULT)
        request.assert_called_once_with(
            'GET',
            f'http://tts-test:8001/internal/v1/artifacts/{ARTIFACT_KEY}',
            json=None,
            headers={'X-TTS-Internal-Token': 'dev-tts-internal-token-change-me'},
            timeout=(0.25, 2.0),
        )

    def test_rejects_an_untrusted_artifact_url(self):
        response = Mock(status_code=200)
        response.json.return_value = {**READY_RESULT, 'asset_url': 'https://attacker.test/a.mp3'}
        client = TtsServiceClient()

        with (
            patch.object(client.session, 'request', return_value=response),
            self.assertRaises(SpeechServiceUnavailable),
        ):
            client.artifact_status(ARTIFACT_KEY)


class BlogSpeechAssetTests(TestCase):
    def setUp(self):
        self.category = PostCategory.objects.create(name='Nghề nghiệp')
        self.post = Post.objects.create(
            title='Bài viết có audio',
            category=self.category,
            summary='Sapo.',
            content='<p>Nội dung công khai.</p>',
            status=Post.Status.PUBLISHED,
            published_at=timezone.now(),
        )

    def register(self, **session_overrides):
        return register_blog_speech_generation(
            post=self.post,
            session={**SESSION, **session_overrides},
            text_hash='c' * 64,
            voice_id='north-male-natural',
            style='tu_nhien',
        )

    @patch('apps.speech.tasks.assets.finalize_blog_speech_asset.delay')
    def test_registration_is_durable_idempotent_and_dispatches_once(self, delay):
        with self.captureOnCommitCallbacks(execute=True):
            first = self.register()
        with self.captureOnCommitCallbacks(execute=True):
            second = self.register()

        self.assertEqual(first.pk, second.pk)
        self.assertEqual(BlogSpeechAsset.objects.count(), 1)
        self.assertEqual(first.status, BlogSpeechAsset.Status.GENERATING)
        self.assertEqual(first.artifact_key, ARTIFACT_KEY)
        self.assertEqual(first.config_hash, CONFIG_HASH)
        delay.assert_called_once_with(first.pk)

    @patch('apps.speech.tasks.assets.finalize_blog_speech_asset.delay')
    def test_rollback_persists_neither_asset_nor_dispatch(self, delay):
        with self.captureOnCommitCallbacks(execute=True):
            with self.assertRaises(RuntimeError), transaction.atomic():
                self.register()
                raise RuntimeError('rollback')

        self.assertFalse(BlogSpeechAsset.objects.exists())
        delay.assert_not_called()

    def test_publish_does_not_create_an_unheard_artifact(self):
        post = Post.objects.create(
            title='Bài chờ duyệt',
            category=self.category,
            summary='Sapo.',
            content='<p>Nội dung.</p>',
            status=Post.Status.PENDING,
        )

        published = publish_post(post=post, actor=None)

        self.assertEqual(published.status, Post.Status.PUBLISHED)
        self.assertFalse(BlogSpeechAsset.objects.filter(post=published).exists())

    @patch('apps.speech.tasks.assets.persist_tts_speech_artifact')
    @patch('apps.speech.tasks.assets.tts_service_client.artifact_status')
    def test_finalizer_copies_live_mp3_and_is_repeat_safe(self, status, persist):
        status.return_value = READY_RESULT
        persist.return_value = f'speech/artifacts/v2/{ARTIFACT_KEY}.mp3'
        with self.captureOnCommitCallbacks(execute=False):
            asset = self.register()

        finalize_blog_speech_asset.run(asset.pk)
        finalize_blog_speech_asset.run(asset.pk)

        asset.refresh_from_db()
        self.assertEqual(asset.status, BlogSpeechAsset.Status.READY)
        self.assertEqual(asset.storage_key, f'speech/artifacts/v2/{ARTIFACT_KEY}.mp3')
        self.assertEqual(asset.duration_ms, 12_345)
        status.assert_called_once_with(ARTIFACT_KEY)
        persist.assert_called_once_with(READY_RESULT)

    @patch('apps.speech.tasks.assets.persist_tts_speech_artifact')
    @patch('apps.speech.tasks.assets.tts_service_client.artifact_status')
    def test_active_finalizer_lease_prevents_a_duplicate_copy(self, status, persist):
        status.return_value = READY_RESULT
        with self.captureOnCommitCallbacks(execute=False):
            asset = self.register()
        BlogSpeechAsset.objects.filter(pk=asset.pk).update(
            finalize_lease_until=timezone.now() + timedelta(minutes=5)
        )

        finalize_blog_speech_asset.run(asset.pk)

        status.assert_not_called()
        persist.assert_not_called()
        asset.refresh_from_db()
        self.assertEqual(asset.status, BlogSpeechAsset.Status.GENERATING)

    @patch('apps.speech.tasks.assets.finalize_blog_speech_asset.delay')
    def test_reconcile_skips_an_asset_with_an_active_finalizer_lease(self, delay):
        with self.captureOnCommitCallbacks(execute=False):
            asset = self.register()
        BlogSpeechAsset.objects.filter(pk=asset.pk).update(
            finalize_lease_until=timezone.now() + timedelta(minutes=5)
        )

        dispatched = reconcile_speech_artifacts.run(limit=5)

        self.assertEqual(dispatched, 0)
        delay.assert_not_called()

    @patch('apps.speech.tasks.assets.tts_service_client.artifact_status')
    def test_finalizer_discards_a_stale_post_revision(self, status):
        asset = BlogSpeechAsset.objects.create(
            post=self.post,
            post_revision=self.post.edit_revision + 1,
            text_hash='c' * 64,
            artifact_key=ARTIFACT_KEY,
            config_hash=CONFIG_HASH,
            model_revision=SESSION['model_revision'],
            voice_id='north-male-natural',
            style='tu_nhien',
            started_at=timezone.now(),
        )

        finalize_blog_speech_asset.run(asset.pk)

        asset.refresh_from_db()
        self.assertEqual(asset.status, BlogSpeechAsset.Status.FAILED)
        self.assertEqual(asset.error_code, 'stale_post_revision')
        status.assert_not_called()

    @patch('apps.speech.tasks.assets.finalize_blog_speech_asset.delay')
    def test_reconcile_does_not_backfill_an_unheard_post(self, delay):
        dispatched = reconcile_speech_artifacts.run(limit=5)

        self.assertEqual(dispatched, 0)
        self.assertFalse(BlogSpeechAsset.objects.filter(post=self.post).exists())
        delay.assert_not_called()

    @override_settings(SPEECH_ARTIFACT_RETENTION_DAYS=30)
    @patch('apps.speech.tasks.assets.public_media_storage')
    def test_purge_removes_expired_legacy_object_and_row(self, storage_factory):
        asset = BlogSpeechAsset.objects.create(
            post=self.post,
            post_revision=self.post.edit_revision,
            text_hash='c' * 64,
            artifact_key='d' * 64,
            config_hash=CONFIG_HASH,
            model_revision=SESSION['model_revision'],
            voice_id='north-male-natural',
            style='tu_nhien',
            status=BlogSpeechAsset.Status.FAILED,
            storage_key='speech/artifacts/v1/legacy.mp3',
            error_code='legacy_artifact_invalidated',
        )
        BlogSpeechAsset.objects.filter(pk=asset.pk).update(
            updated_at=timezone.now() - timedelta(days=31)
        )

        purged = purge_obsolete_speech_artifacts.run(limit=5)

        self.assertEqual(purged, 1)
        storage_factory.return_value.delete.assert_called_once_with(
            'speech/artifacts/v1/legacy.mp3'
        )
        self.assertFalse(BlogSpeechAsset.objects.filter(pk=asset.pk).exists())


class ConcurrentBlogSpeechAssetTests(TransactionTestCase):
    reset_sequences = True

    def setUp(self):
        category = PostCategory.objects.create(name='Đồng thời')
        self.post = Post.objects.create(
            title='Mười người nghe cùng lúc',
            category=category,
            content='<p>Nội dung.</p>',
            status=Post.Status.PUBLISHED,
            published_at=timezone.now(),
        )

    @patch('apps.speech.tasks.assets.finalize_blog_speech_asset.delay')
    def test_ten_listeners_share_one_generating_row_and_one_finalizer(self, delay):
        def register(_index):
            try:
                return register_blog_speech_generation(
                    post=self.post,
                    session=SESSION,
                    text_hash='c' * 64,
                    voice_id='north-male-natural',
                    style='tu_nhien',
                ).pk
            finally:
                close_old_connections()

        with ThreadPoolExecutor(max_workers=10) as executor:
            asset_ids = list(executor.map(register, range(10)))

        self.assertEqual(len(set(asset_ids)), 1)
        self.assertEqual(BlogSpeechAsset.objects.count(), 1)
        self.assertEqual(delay.call_count, 1)
