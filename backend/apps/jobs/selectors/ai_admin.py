"""Privacy-safe read models for the AI job-generation admin dashboard."""

import math
from datetime import datetime, time, timedelta
from decimal import Decimal

from django.conf import settings
from django.db.models import Count, Min, Q, Sum
from django.utils import timezone

from apps.ai_core.models import AiInvocation, AiUsageDaily
from apps.sitecontent.models import SiteSetting

from ..models import JobAiGeneration

POLICY_KEYS = (
    'ai_job_generation_enabled',
    'ai_job_generation_model',
    'ai_job_generation_daily_limit',
    'ai_job_generation_rollout_percent',
    'ai_job_generation_company_allowlist',
    'ai_job_generation_model_allowlist',
)


def _sum(field):
    return Sum(field, default=0)


def job_ai_usage_overview(*, days):
    """Aggregate shared AI metadata through its public models only."""
    if isinstance(days, bool) or not isinstance(days, int) or not 1 <= days <= 365:
        raise ValueError('days must be an integer between 1 and 365.')
    end_date = timezone.localdate()
    start_date = end_date - timedelta(days=days - 1)
    start_at = timezone.make_aware(datetime.combine(start_date, time.min))
    end_at = timezone.make_aware(datetime.combine(end_date + timedelta(days=1), time.min))
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


def _as_bool(value, default=False):
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in {'1', 'true', 'yes', 'on'}
    return default


def _as_int(value, default=0):
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _as_string_list(value):
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if isinstance(value, str):
        return [item.strip() for item in value.split(',') if item.strip()]
    return []


def job_ai_admin_policy_overview():
    values = dict(SiteSetting.objects.filter(key__in=POLICY_KEYS).values_list('key', 'value'))
    env_model = str(getattr(settings, 'AI_JOB_GENERATION_MODEL', 'gemini-3.5-flash-lite')).strip()
    env_models = _as_string_list(
        getattr(settings, 'AI_JOB_GENERATION_MODEL_ALLOWLIST', (env_model,))
    ) or [env_model]
    site_models = _as_string_list(values.get('ai_job_generation_model_allowlist'))
    allowed_models = [model for model in env_models if not site_models or model in site_models]
    requested_model = str(values.get('ai_job_generation_model') or env_model).strip()
    effective_model = requested_model if requested_model in allowed_models else ''
    env_daily_limit = max(
        _as_int(getattr(settings, 'AI_JOB_GENERATION_DAILY_LIMIT', 10), 10),
        0,
    )
    daily_limit = min(
        env_daily_limit,
        max(_as_int(values.get('ai_job_generation_daily_limit'), env_daily_limit), 0),
    )
    rollout_percent = min(
        max(_as_int(values.get('ai_job_generation_rollout_percent'), 0), 0),
        100,
    )
    company_allowlist = _as_string_list(values.get('ai_job_generation_company_allowlist'))
    hard_switch_enabled = getattr(settings, 'AI_RUNTIME_ENABLED', False) is True
    soft_switch_enabled = _as_bool(values.get('ai_job_generation_enabled'), False)
    return {
        'enabled': hard_switch_enabled and soft_switch_enabled and bool(effective_model),
        'hard_switch_enabled': hard_switch_enabled,
        'soft_switch_enabled': soft_switch_enabled,
        'provider': 'gemini',
        'provider_backend': str(getattr(settings, 'AI_PROVIDER_BACKEND', 'gemini_developer')),
        'model': effective_model or requested_model,
        'model_allowed': bool(effective_model),
        'allowed_models': allowed_models,
        'daily_limit': daily_limit,
        'rollout_percent': rollout_percent,
        'company_allowlist_count': len(set(company_allowlist)),
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
