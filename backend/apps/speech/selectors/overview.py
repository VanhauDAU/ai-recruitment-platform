from datetime import timedelta

from django.db.models import Count, Sum
from django.db.models.functions import Coalesce
from django.utils import timezone

from ..models import BlogSpeechAsset, SpeechUsageDaily

USAGE_FIELDS = (
    'session_count',
    'generation_count',
    'requested_chars',
    'cache_hit_count',
    'cache_miss_count',
    'rejected_count',
    'unavailable_count',
    'durable_artifact_count',
    'durable_artifact_bytes',
    'durable_audio_ms',
)


def speech_admin_overview(*, runtime, policy):
    today = timezone.localdate()
    usage_rows = list(
        SpeechUsageDaily.objects.filter(date__gte=today - timedelta(days=29))
        .order_by('date', 'surface')
        .values('date', 'surface', *USAGE_FIELDS)
    )
    artifacts = BlogSpeechAsset.objects.aggregate(
        total=Count('id'),
        size_bytes=Coalesce(Sum('size_bytes'), 0),
        duration_ms=Coalesce(Sum('duration_ms'), 0),
    )
    artifacts['by_status'] = {
        row['status']: row['count']
        for row in BlogSpeechAsset.objects.values('status')
        .annotate(count=Count('id'))
        .order_by('status')
    }
    return {
        'policy': policy,
        'runtime': runtime,
        'artifacts': artifacts,
        'usage': {
            'days_7': _sum_usage(usage_rows, today - timedelta(days=6)),
            'days_30': _sum_usage(usage_rows, today - timedelta(days=29)),
            'daily': [{**row, 'date': row['date'].isoformat()} for row in usage_rows],
        },
    }


def _sum_usage(rows, cutoff):
    totals = {field: 0 for field in USAGE_FIELDS}
    for row in rows:
        if row['date'] < cutoff:
            continue
        for field in USAGE_FIELDS:
            totals[field] += row[field]
    return totals
