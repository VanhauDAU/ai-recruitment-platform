"""Atomic durable aggregation for AI runtime usage."""

from django.db import IntegrityError, transaction
from django.db.models import F
from django.utils import timezone

from ..models import AiUsageDaily


def _ensure_usage_row(dimensions):
    try:
        with transaction.atomic():
            AiUsageDaily.objects.get_or_create(**dimensions)
    except IntegrityError:
        pass


def record_ai_usage(
    *,
    use_case,
    provider,
    provider_backend,
    model,
    succeeded,
    retry_count,
    usage,
    cost_usd,
    latency_ms,
):
    dimensions = {
        'date': timezone.localdate(),
        'use_case': use_case,
        'provider': provider,
        'provider_backend': provider_backend,
        'model': model,
    }
    _ensure_usage_row(dimensions)
    AiUsageDaily.objects.filter(**dimensions).update(
        invocation_count=F('invocation_count') + 1,
        success_count=F('success_count') + int(succeeded),
        failure_count=F('failure_count') + int(not succeeded),
        retry_count=F('retry_count') + max(0, int(retry_count)),
        input_tokens=F('input_tokens') + usage.input_tokens,
        output_tokens=F('output_tokens') + usage.output_tokens,
        total_tokens=F('total_tokens') + usage.total_tokens,
        cached_tokens=F('cached_tokens') + usage.cached_tokens,
        cost_usd=F('cost_usd') + cost_usd,
        total_latency_ms=F('total_latency_ms') + max(0, int(latency_ms)),
        updated_at=timezone.now(),
    )


def record_ai_quota_rejection(*, use_case, provider, provider_backend, model):
    """Increment a durable quota rejection without fabricating a provider call."""
    dimensions = {
        'date': timezone.localdate(),
        'use_case': use_case,
        'provider': provider,
        'provider_backend': provider_backend,
        'model': model,
    }
    _ensure_usage_row(dimensions)
    AiUsageDaily.objects.filter(**dimensions).update(
        quota_rejection_count=F('quota_rejection_count') + 1,
        updated_at=timezone.now(),
    )
