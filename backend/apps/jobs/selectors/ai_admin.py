"""Privacy-safe read models for the AI job-generation admin dashboard."""

import math
from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.db.models import Count, Min, Q, Sum
from django.utils import timezone

from apps.ai_core.models import AiInvocation, AiUsageDaily
from apps.sitecontent.selectors import get_settings_map
from common.vietnam_time import vietnam_day_start, vietnam_today

from ..domain import JOB_AI_POLICY_KEYS, resolve_job_ai_policy
from ..models import JobAiGeneration


def _sum(field):
    return Sum(field, default=0)


def job_ai_usage_overview(*, days):
    """Aggregate shared AI metadata through its public models only."""
    if isinstance(days, bool) or not isinstance(days, int) or not 1 <= days <= 365:
        raise ValueError('days must be an integer between 1 and 365.')
    end_date = vietnam_today()
    start_date = end_date - timedelta(days=days - 1)
    start_at = vietnam_day_start(start_date)
    end_at = vietnam_day_start(end_date + timedelta(days=1))
    usage_rows = AiUsageDaily.objects.filter(
        date__gte=start_date,
        date__lte=end_date,
        use_case='job_post_generation',
    )
    invocations = AiInvocation.objects.filter(
        created_at__gte=start_at,
        created_at__lt=end_at,
        completed_at__isnull=False,
        use_case='job_post_generation',
    )
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
    return {
        'days': days,
        'start_date': start_date,
        'end_date': end_date,
        **aggregate,
        'cost_usd': aggregate['cost_usd'] or Decimal('0'),
        'p95_latency_ms': p95_latency_ms,
    }


def job_ai_admin_policy_overview():
    policy = resolve_job_ai_policy(get_settings_map(JOB_AI_POLICY_KEYS))
    return {
        'enabled': policy.enabled,
        'hard_switch_enabled': policy.hard_switch_enabled,
        'soft_switch_enabled': policy.soft_switch_enabled,
        'provider': 'gemini',
        'provider_backend': settings.AI_PROVIDER_BACKEND,
        'model': policy.model or policy.requested_model,
        'model_allowed': bool(policy.model),
        'allowed_models': list(policy.allowed_models),
        'daily_limit': policy.daily_limit,
        'rollout_percent': policy.rollout_percent,
        # Chỉ trả số lượng: dashboard không được lộ mã công ty đang thử nghiệm.
        'company_allowlist_count': len(policy.company_allowlist),
    }


def job_ai_queue_overview():
    active = JobAiGeneration.objects.filter(
        status__in=[JobAiGeneration.Status.QUEUED, JobAiGeneration.Status.PROCESSING]
    ).aggregate(
        waiting=Count('id', filter=Q(status=JobAiGeneration.Status.QUEUED)),
        active=Count('id', filter=Q(status=JobAiGeneration.Status.PROCESSING)),
        oldest_queued_at=Min('created_at', filter=Q(status=JobAiGeneration.Status.QUEUED)),
    )
    oldest_queued_at = active.pop('oldest_queued_at')
    oldest_queued_seconds = (
        max(0, int((timezone.now() - oldest_queued_at).total_seconds())) if oldest_queued_at else 0
    )
    return {
        'name': 'ai-generation',
        'status': 'backlogged' if oldest_queued_seconds >= 60 else 'healthy',
        'worker_concurrency': 2,
        'waiting': active['waiting'],
        'active': active['active'],
        'oldest_queued_seconds': oldest_queued_seconds,
    }
