"""Candidate-owned paid resurfacing of jobs they explicitly saved."""

from datetime import timedelta
from zoneinfo import ZoneInfo

from django.db.models import Count, Prefetch
from django.utils import timezone

from apps.services.models import (
    JobServiceActivation,
    JobServiceActivationItem,
    SavedJobRemarketingImpression,
    ServiceCapability,
)

from ..models import Job, SavedJob
from ..models.querysets import publicly_available_job_filter

VIETNAM_TZ = ZoneInfo('Asia/Ho_Chi_Minh')


def saved_job_remarketing_lane(candidate, *, limit=6, at=None):
    """Return a bounded, diverse lane without mutating frequency counters."""
    at = at or timezone.now()
    today = timezone.localdate(at, timezone=VIETNAM_TZ)
    effective_activations = (
        JobServiceActivation.objects.filter(
            status=JobServiceActivation.Status.ACTIVE,
            starts_at__lte=at,
            ends_at__gt=at,
            items__capability__code=ServiceCapability.Code.SAVED_REMARKETING,
            items__starts_at__lte=at,
            items__ends_at__gt=at,
        )
        .order_by('-ends_at', '-id')
        .distinct()
        .prefetch_related(
            Prefetch(
                'items',
                queryset=JobServiceActivationItem.objects.filter(
                    starts_at__lte=at,
                    ends_at__gt=at,
                )
                .select_related('capability')
                .order_by('id'),
                to_attr='effective_presentation_items',
            )
        )
    )
    rows = list(
        SavedJob.objects.filter(
            candidate=candidate,
            job_id__in=Job.objects.filter(publicly_available_job_filter()).values('pk'),
            job__service_activations__in=effective_activations,
        )
        .exclude(job__applications__candidate=candidate)
        .select_related('job__company', 'job__posted_by')
        .prefetch_related(
            'job__category_assignments__category',
            'job__job_locations__location__parent',
            'job__job_skills__skill',
            Prefetch(
                'job__service_activations',
                queryset=effective_activations,
                to_attr='effective_service_activations',
            ),
        )
        .order_by('-created_at', '-pk')
        .distinct()[: max(limit * 4, limit)]
    )
    job_ids = [row.job_id for row in rows]
    recent_since = at - timedelta(days=7)
    recent_counts = {
        row['job_id']: row['count']
        for row in (
            SavedJobRemarketingImpression.objects.filter(
                candidate=candidate,
                job_id__in=job_ids,
                shown_at__gte=recent_since,
            )
            .values('job_id')
            .annotate(count=Count('pk'))
        )
    }
    shown_today = set(
        SavedJobRemarketingImpression.objects.filter(
            candidate=candidate,
            job_id__in=job_ids,
            shown_on=today,
        ).values_list('job_id', flat=True)
    )

    results = []
    companies = set()
    for row in rows:
        job = row.job
        activations = getattr(job, 'effective_service_activations', [])
        if (
            not activations
            or job.pk in shown_today
            or recent_counts.get(job.pk, 0) >= 3
            or job.company_id in companies
        ):
            continue
        companies.add(job.company_id)
        results.append(
            {
                'job': job,
                'activation_public_id': activations[0].public_id,
                'display_reason': 'Bạn đã lưu tin này trước đây',
            }
        )
        if len(results) >= limit:
            break
    return results
