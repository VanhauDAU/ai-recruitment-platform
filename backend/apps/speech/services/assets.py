import logging
from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from apps.blog.models import Post

from ..models import BlogSpeechAsset

logger = logging.getLogger(__name__)


def register_blog_speech_generation(*, post, session, text_hash, voice_id, style):
    """Register one live generation and dispatch one artifact finalizer.

    The TTS session itself is cheap and does not start inference. The unique
    database identity plus row lock ensures concurrent listeners create one
    GENERATING row and enqueue only one finalizer for the shared live stream.
    """
    if post.status != Post.Status.PUBLISHED:
        return None

    now = timezone.now()
    stale_before = now - timedelta(seconds=settings.SPEECH_GENERATION_TIMEOUT_SECONDS)
    with transaction.atomic():
        asset, created = BlogSpeechAsset.objects.get_or_create(
            post=post,
            artifact_key=session['artifact_key'],
            defaults={
                'config_hash': session['config_hash'],
                'model_revision': session['model_revision'],
                'post_revision': post.edit_revision,
                'status': BlogSpeechAsset.Status.GENERATING,
                'style': style,
                'text_hash': text_hash,
                'voice_id': voice_id,
                'started_at': now,
            },
        )
        should_dispatch = created
        if not created:
            asset = BlogSpeechAsset.objects.select_for_update().get(pk=asset.pk)
            if asset.status == BlogSpeechAsset.Status.READY and asset.storage_key:
                return asset
            active = (
                asset.status == BlogSpeechAsset.Status.GENERATING
                and asset.started_at is not None
                and asset.started_at > stale_before
            )
            if active:
                return asset

            asset.config_hash = session['config_hash']
            asset.model_revision = session['model_revision']
            asset.post_revision = post.edit_revision
            asset.status = BlogSpeechAsset.Status.GENERATING
            asset.style = style
            asset.text_hash = text_hash
            asset.voice_id = voice_id
            asset.storage_key = ''
            asset.mime_type = ''
            asset.duration_ms = None
            asset.size_bytes = None
            asset.error_code = ''
            asset.started_at = now
            asset.finalize_lease_until = None
            asset.completed_at = None
            asset.save(
                update_fields=[
                    'completed_at',
                    'config_hash',
                    'duration_ms',
                    'error_code',
                    'finalize_lease_until',
                    'mime_type',
                    'model_revision',
                    'post_revision',
                    'size_bytes',
                    'started_at',
                    'status',
                    'storage_key',
                    'style',
                    'text_hash',
                    'updated_at',
                    'voice_id',
                ]
            )
            should_dispatch = True

        if should_dispatch:
            asset_id = asset.pk

            def dispatch():
                from ..tasks import finalize_blog_speech_asset

                try:
                    finalize_blog_speech_asset.delay(asset_id)
                except Exception:  # noqa: BLE001 - reconciliation owns recovery
                    logger.exception('Unable to enqueue speech artifact finalizer %s.', asset_id)
                    BlogSpeechAsset.objects.filter(
                        pk=asset_id,
                        status=BlogSpeechAsset.Status.GENERATING,
                    ).update(error_code='queue_unavailable', updated_at=timezone.now())

            transaction.on_commit(dispatch)

    return asset
