from dataclasses import dataclass
from math import ceil

from django.db.models import Exists, OuterRef
from django.utils import timezone

from apps.services.models import JobServiceActivationItem, ServiceCapability


@dataclass(frozen=True)
class DistributedJobPage:
    items: list
    total: int
    total_pages: int
    page: int
    page_size: int


def _sponsored_representative_ids(queryset, *, at):
    active_sponsorship = JobServiceActivationItem.objects.filter(
        activation__job_id=OuterRef('pk'),
        activation__status='active',
        activation__starts_at__lte=at,
        activation__ends_at__gt=at,
        capability__code=ServiceCapability.Code.SPONSORED_PLACEMENT,
        starts_at__lte=at,
        ends_at__gt=at,
    )
    eligible = queryset.annotate(_has_active_sponsorship=Exists(active_sponsorship)).filter(
        _has_active_sponsorship=True
    )
    # PostgreSQL DISTINCT ON selects one deterministic sponsored representative
    # per company. Other paid jobs remain in the organic lane rather than being hidden.
    return (
        eligible.order_by('company_id', '-lifecycle_recency', '-created_at', '-id')
        .distinct('company_id')
        .values('pk')
    )


def _interleave(organic, sponsored, page_size):
    sponsored = list(sponsored)
    organic = list(organic)
    if not sponsored:
        return organic
    sponsored_positions = {min(index * 5, page_size - 1) for index in range(len(sponsored))}
    result = []
    sponsored_index = 0
    organic_index = 0
    for position in range(page_size):
        if position in sponsored_positions and sponsored_index < len(sponsored):
            result.append(sponsored[sponsored_index])
            sponsored_index += 1
        elif organic_index < len(organic):
            result.append(organic[organic_index])
            organic_index += 1
        elif sponsored_index < len(sponsored):
            result.append(sponsored[sponsored_index])
            sponsored_index += 1
    return result


def distribute_sponsored_job_page(queryset, *, page, page_size, at=None):
    """Return a stable page with at most two sponsored jobs per ten results."""
    at = at or timezone.now()
    page = max(int(page), 1)
    page_size = max(int(page_size), 1)
    sponsored_quota = page_size // 5
    if sponsored_quota == 0:
        total = queryset.count()
        start = (page - 1) * page_size
        return DistributedJobPage(
            items=list(queryset[start : start + page_size]),
            total=total,
            total_pages=ceil(total / page_size) if total else 0,
            page=page,
            page_size=page_size,
        )

    representative_ids = _sponsored_representative_ids(queryset, at=at)
    sponsored_queryset = queryset.filter(pk__in=representative_ids).order_by(
        '-lifecycle_recency', '-created_at', '-id'
    )
    organic_queryset = queryset.exclude(pk__in=representative_ids)
    sponsored_total = sponsored_queryset.count()
    organic_total = organic_queryset.count()
    total = sponsored_total + organic_total

    sponsored_before = min(sponsored_total, (page - 1) * sponsored_quota)
    sponsored_count = min(sponsored_quota, sponsored_total - sponsored_before)
    organic_before = max((page - 1) * page_size - sponsored_before, 0)
    organic_count = page_size - sponsored_count
    sponsored_ids = list(
        sponsored_queryset.values_list('pk', flat=True)[
            sponsored_before : sponsored_before + sponsored_count
        ]
    )
    organic_ids = list(
        organic_queryset.values_list('pk', flat=True)[
            organic_before : organic_before + organic_count
        ]
    )
    ordered_ids = _interleave(organic_ids, sponsored_ids, page_size)
    jobs_by_id = {job.pk: job for job in queryset.filter(pk__in=ordered_ids)}
    return DistributedJobPage(
        items=[jobs_by_id[job_id] for job_id in ordered_ids],
        total=total,
        total_pages=ceil(total / page_size) if total else 0,
        page=page,
        page_size=page_size,
    )
