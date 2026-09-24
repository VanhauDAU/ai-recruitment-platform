"""Privacy-safe operational aggregates for admin dashboards."""

import math
from datetime import datetime, time, timedelta
from decimal import Decimal

from django.db.models import Sum
from django.utils import timezone

from ..models import AiInvocation, AiUsageDaily


def _sum(field):
    return Sum(field, default=0)


def ai_usage_overview(*, days=30, use_case=None):
    """Return daily totals and exact invocation P95 for a bounded date window."""
    if isinstance(days, bool) or not isinstance(days, int) or not 1 <= days <= 365:
        raise ValueError('days must be an integer between 1 and 365.')
    if use_case is not None and (not isinstance(use_case, str) or not use_case.strip()):
        raise ValueError('use_case must be a non-empty string when provided.')

    end_date = timezone.localdate()
    start_date = end_date - timedelta(days=days - 1)
    start_at = timezone.make_aware(datetime.combine(start_date, time.min))
    end_at = timezone.make_aware(datetime.combine(end_date + timedelta(days=1), time.min))
    usage_rows = AiUsageDaily.objects.filter(date__gte=start_date, date__lte=end_date)
    invocations = AiInvocation.objects.filter(
        created_at__gte=start_at,
        created_at__lt=end_at,
        completed_at__isnull=False,
    )
    if use_case is not None:
        normalized_use_case = use_case.strip()
        usage_rows = usage_rows.filter(use_case=normalized_use_case)
        invocations = invocations.filter(use_case=normalized_use_case)

    aggregate = usage_rows.aggregate(
        invocation_count=_sum('invocation_count'),
        success_count=_sum('success_count'),
        failure_count=_sum('failure_count'),
        quota_rejection_count=_sum('quota_rejection_count'),
        retry_count=_sum('retry_count'),
        input_tokens=_sum('input_tokens'),
        output_tokens=_sum('output_tokens'),
        total_tokens=_sum('total_tokens'),
        cached_tokens=_sum('cached_tokens'),
        cost_usd=_sum('cost_usd'),
        total_latency_ms=_sum('total_latency_ms'),
    )
    invocation_count = invocations.count()
    if invocation_count:
        p95_index = max(0, math.ceil(invocation_count * 0.95) - 1)
        p95_latency_ms = invocations.order_by('latency_ms').values_list('latency_ms', flat=True)[
            p95_index
        ]
    else:
        p95_latency_ms = 0

    series = list(
        usage_rows.order_by('date', 'use_case', 'provider', 'provider_backend', 'model').values(
            'date',
            'use_case',
            'provider',
            'provider_backend',
            'model',
            'invocation_count',
            'success_count',
            'failure_count',
            'quota_rejection_count',
            'retry_count',
            'input_tokens',
            'output_tokens',
            'total_tokens',
            'cached_tokens',
            'cost_usd',
            'total_latency_ms',
        )
    )
    return {
        'days': days,
        'start_date': start_date,
        'end_date': end_date,
        'invocation_count': aggregate['invocation_count'],
        'success_count': aggregate['success_count'],
        'failure_count': aggregate['failure_count'],
        'quota_rejection_count': aggregate['quota_rejection_count'],
        'retry_count': aggregate['retry_count'],
        'input_tokens': aggregate['input_tokens'],
        'output_tokens': aggregate['output_tokens'],
        'total_tokens': aggregate['total_tokens'],
        'cached_tokens': aggregate['cached_tokens'],
        'cost_usd': aggregate['cost_usd'] or Decimal('0'),
        'total_latency_ms': aggregate['total_latency_ms'],
        'p95_latency_ms': p95_latency_ms,
        'series': series,
    }
