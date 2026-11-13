"""Bounded retention cleanup for privacy-safe AI operational metadata."""

from datetime import timedelta

from celery import shared_task
from django.conf import settings
from django.db import transaction
from django.utils import timezone

from ..models import AiInvocation, AiUsageDaily

DEFAULT_RETENTION_DAYS = 365
DEFAULT_BATCH_SIZE = 1000
MAX_BATCH_SIZE = 5000


def _positive_int(value, default):
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return default
    return parsed if parsed > 0 else default


def _delete_batches(queryset, *, batch_size):
    deleted = 0
    while True:
        ids = list(queryset.order_by('pk').values_list('pk', flat=True)[:batch_size])
        if not ids:
            return deleted
        with transaction.atomic():
            count, _details = queryset.model.objects.filter(pk__in=ids).delete()
        deleted += count


@shared_task(name='apps.ai_core.tasks.purge_expired_ai_metadata')
def purge_expired_ai_metadata(*, batch_size=DEFAULT_BATCH_SIZE):
    """Delete expired invocation and daily aggregate rows in bounded transactions."""
    retention_days = _positive_int(
        getattr(
            settings,
            'AI_INVOCATION_METADATA_RETENTION_DAYS',
            DEFAULT_RETENTION_DAYS,
        ),
        DEFAULT_RETENTION_DAYS,
    )
    normalized_batch_size = min(
        MAX_BATCH_SIZE,
        _positive_int(batch_size, DEFAULT_BATCH_SIZE),
    )
    cutoff_at = timezone.now() - timedelta(days=retention_days)
    invocation_count = _delete_batches(
        AiInvocation.objects.filter(created_at__lt=cutoff_at),
        batch_size=normalized_batch_size,
    )
    usage_count = _delete_batches(
        AiUsageDaily.objects.filter(date__lt=cutoff_at.date()),
        batch_size=normalized_batch_size,
    )
    return {
        'invocations_deleted': invocation_count,
        'usage_rows_deleted': usage_count,
        'retention_days': retention_days,
    }
