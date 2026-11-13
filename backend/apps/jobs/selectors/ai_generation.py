"""Read models for employer and admin job-generation surfaces."""

from datetime import timedelta

from django.db.models import Count, Q
from django.utils import timezone

from ..models import JobAiGeneration


def employer_job_ai_generation_queryset(user):
    return JobAiGeneration.objects.filter(owner=user).select_related('company', 'applied_job')


def job_ai_admin_overview(*, days=30):
    days = min(max(int(days), 1), 365)
    cutoff = timezone.now() - timedelta(days=days)
    queryset = JobAiGeneration.objects.filter(created_at__gte=cutoff)
    aggregate = queryset.aggregate(
        total=Count('id'),
        queued=Count('id', filter=Q(status=JobAiGeneration.Status.QUEUED)),
        processing=Count('id', filter=Q(status=JobAiGeneration.Status.PROCESSING)),
        completed=Count('id', filter=Q(status=JobAiGeneration.Status.COMPLETED)),
        failed=Count('id', filter=Q(status=JobAiGeneration.Status.FAILED)),
        cancelled=Count('id', filter=Q(status=JobAiGeneration.Status.CANCELLED)),
        applied=Count('id', filter=Q(applied_job__isnull=False)),
    )
    terminal = aggregate['completed'] + aggregate['failed']
    aggregate['success_rate'] = round(aggregate['completed'] / terminal, 4) if terminal else 0.0
    aggregate['apply_rate'] = (
        round(aggregate['applied'] / aggregate['completed'], 4) if aggregate['completed'] else 0.0
    )
    aggregate['error_counts'] = list(
        queryset.filter(status=JobAiGeneration.Status.FAILED)
        .exclude(error_code='')
        .values('error_code')
        .annotate(count=Count('id'))
        .order_by('-count', 'error_code')[:20]
    )
    aggregate['days'] = days
    return aggregate
