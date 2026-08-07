import logging
from datetime import timedelta

from celery import shared_task
from django.conf import settings
from django.db import transaction
from django.db.models import F, Q
from django.utils import timezone

from apps.blog.models import Post
from common.r2_storage import public_media_storage

from ..models import BlogSpeechAsset
from ..services.artifacts import persist_tts_speech_artifact
from ..services.client import (
    SpeechServiceRejected,
    SpeechServiceUnavailable,
    tts_service_client,
)
from ..services.usage import record_speech_usage

logger = logging.getLogger(__name__)
RECONCILE_BATCH_SIZE = 25
FINALIZER_LEASE_GRACE_SECONDS = 90


def _claim_finalizer(asset_id):
    """Claim a short DB lease so retries/reconciliation cannot copy twice."""
    now = timezone.now()
    lease_until = now + timedelta(
        seconds=settings.SPEECH_ARTIFACT_DOWNLOAD_TIMEOUT_SECONDS + FINALIZER_LEASE_GRACE_SECONDS
    )
    available = Q(finalize_lease_until__isnull=True) | Q(finalize_lease_until__lte=now)
    claimed = (
        BlogSpeechAsset.objects.filter(
            pk=asset_id,
            status=BlogSpeechAsset.Status.GENERATING,
        )
        .filter(available)
        .update(finalize_lease_until=lease_until, updated_at=now)
    )
    if not claimed:
        return None
    return BlogSpeechAsset.objects.select_related('post').filter(pk=asset_id).first()


def _release_finalizer(asset_id):
    BlogSpeechAsset.objects.filter(
        pk=asset_id,
        status=BlogSpeechAsset.Status.GENERATING,
    ).update(finalize_lease_until=None, updated_at=timezone.now())


def _finish_failed(asset_id, error_code):
    BlogSpeechAsset.objects.filter(
        pk=asset_id,
        status=BlogSpeechAsset.Status.GENERATING,
    ).update(
        status=BlogSpeechAsset.Status.FAILED,
        error_code=error_code,
        finalize_lease_until=None,
        completed_at=timezone.now(),
        updated_at=timezone.now(),
    )


def _retry_or_fail(task, asset, error_code):
    elapsed = (timezone.now() - asset.started_at).total_seconds() if asset.started_at else 0
    if elapsed >= settings.SPEECH_GENERATION_TIMEOUT_SECONDS:
        _finish_failed(asset.pk, error_code)
        return asset.pk
    _release_finalizer(asset.pk)
    raise task.retry(countdown=settings.SPEECH_ARTIFACT_POLL_INTERVAL_SECONDS)


@shared_task(
    bind=True,
    max_retries=None,
    soft_time_limit=int(settings.SPEECH_ARTIFACT_DOWNLOAD_TIMEOUT_SECONDS) + 30,
    time_limit=int(settings.SPEECH_ARTIFACT_DOWNLOAD_TIMEOUT_SECONDS) + 60,
)
def finalize_blog_speech_asset(self, asset_id):
    """Copy the MP3 produced by the live inference; never synthesize audio."""
    asset = _claim_finalizer(asset_id)
    if asset is None:
        return asset_id
    if (
        asset.post.status != Post.Status.PUBLISHED
        or asset.post.edit_revision != asset.post_revision
    ):
        _finish_failed(asset_id, 'stale_post_revision')
        return asset_id

    try:
        result = tts_service_client.artifact_status(asset.artifact_key)
    except (SpeechServiceRejected, SpeechServiceUnavailable):
        return _retry_or_fail(self, asset, 'tts_unavailable')

    if result['status'] in {'MISSING', 'GENERATING'}:
        code = 'generation_not_started' if result['status'] == 'MISSING' else 'generation_timeout'
        return _retry_or_fail(self, asset, code)
    if result['status'] == 'FAILED':
        _finish_failed(asset_id, result.get('error_code') or 'tts_generation_failed')
        return asset_id

    try:
        storage_key = persist_tts_speech_artifact(result)
    except Exception:  # noqa: BLE001 - retry only copies an existing MP3
        logger.exception('Unable to persist speech artifact %s.', asset.artifact_key)
        return _retry_or_fail(self, asset, 'artifact_storage_failed')

    completed = BlogSpeechAsset.objects.filter(
        pk=asset_id,
        artifact_key=asset.artifact_key,
        status=BlogSpeechAsset.Status.GENERATING,
    ).update(
        status=BlogSpeechAsset.Status.READY,
        storage_key=storage_key,
        mime_type=result['mime_type'],
        duration_ms=result['duration_ms'],
        size_bytes=result['size_bytes'],
        error_code='',
        finalize_lease_until=None,
        completed_at=timezone.now(),
        updated_at=timezone.now(),
    )
    if completed:
        record_speech_usage(
            'blog',
            durable_artifact_count=1,
            durable_artifact_bytes=result['size_bytes'],
            durable_audio_ms=result['duration_ms'],
        )
    return asset_id


def _dispatch_asset(asset_id):
    try:
        finalize_blog_speech_asset.delay(asset_id)
    except Exception:  # noqa: BLE001 - the next reconciliation sweep recovers it
        logger.exception('Unable to recover speech artifact %s.', asset_id)


@shared_task
def reconcile_speech_artifacts(limit=RECONCILE_BATCH_SIZE):
    """Recover GENERATING rows after broker, worker, or web process restarts."""
    limit = max(1, min(int(limit), 100))
    asset_ids = list(
        BlogSpeechAsset.objects.filter(status=BlogSpeechAsset.Status.GENERATING)
        .filter(Q(finalize_lease_until__isnull=True) | Q(finalize_lease_until__lte=timezone.now()))
        .order_by('started_at')
        .values_list('pk', flat=True)[:limit]
    )
    for asset_id in asset_ids:
        _dispatch_asset(asset_id)
    return len(asset_ids)


@shared_task
def purge_obsolete_speech_artifacts(limit=RECONCILE_BATCH_SIZE):
    """Delete obsolete/failed durable objects after the configured grace period."""
    limit = max(1, min(int(limit), 100))
    cutoff = timezone.now() - timedelta(days=settings.SPEECH_ARTIFACT_RETENTION_DAYS)
    obsolete_post_revision = Q(
        status=BlogSpeechAsset.Status.READY,
        completed_at__lt=cutoff,
    ) & ~Q(post_revision=F('post__edit_revision'))
    obsolete_model_revision = Q(
        status=BlogSpeechAsset.Status.READY,
        completed_at__lt=cutoff,
    ) & ~Q(model_revision=settings.SPEECH_MODEL_REVISION)
    failed = Q(status=BlogSpeechAsset.Status.FAILED, updated_at__lt=cutoff)
    asset_ids = list(
        BlogSpeechAsset.objects.filter(obsolete_post_revision | obsolete_model_revision | failed)
        .order_by('updated_at')
        .values_list('pk', flat=True)[:limit]
    )
    purged = 0
    storage = public_media_storage()
    for asset_id in asset_ids:
        with transaction.atomic():
            asset = BlogSpeechAsset.objects.select_for_update().filter(pk=asset_id).first()
            if asset is None:
                continue
            storage_key = asset.storage_key
            shared = (
                storage_key
                and BlogSpeechAsset.objects.exclude(pk=asset.pk)
                .filter(
                    status=BlogSpeechAsset.Status.READY,
                    storage_key=storage_key,
                )
                .exists()
            )
            if storage_key and not shared:
                try:
                    storage.delete(storage_key)
                except Exception:  # noqa: BLE001 - retain the row for the next sweep
                    logger.exception('Unable to purge speech artifact %s.', storage_key)
                    continue
            asset.delete()
            purged += 1
    return purged
