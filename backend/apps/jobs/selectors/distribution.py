from dataclasses import dataclass
from math import ceil

from django.conf import settings
from django.db.models import (
    Case,
    CharField,
    Exists,
    F,
    IntegerField,
    OuterRef,
    Q,
    Value,
    When,
)
from django.db.models.functions import MD5, Cast, Concat
from django.utils import timezone

from apps.services.models import (
    JobServiceActivationItem,
    ServiceCapability,
)

from ..models import Job


@dataclass(frozen=True)
class DistributedJobPage:
    items: list
    total: int
    total_pages: int
    page: int
    page_size: int


def _active_sponsorship(*, at, placement=None):
    filters = {
        'activation__job_id': OuterRef('pk'),
        'activation__status': 'active',
        'activation__starts_at__lte': at,
        'activation__ends_at__gt': at,
        'capability__code': ServiceCapability.Code.SPONSORED_PLACEMENT,
        'starts_at__lte': at,
        'ends_at__gt': at,
    }
    if placement:
        filters['configuration__placement'] = placement
    return JobServiceActivationItem.objects.filter(**filters)


def _with_commercial_tier(queryset, *, at):
    """Resolve the paid-first tier without changing the job lifecycle clock.

    `best_jobs_eligible` and legacy TOP jobs form the premium tier;
    `search_sponsored` and legacy FEATURED jobs form the standard paid tier.
    Every eligible paid job remains in its tier -- there is no sparse slot quota
    and no winner-takes-all representative per company.
    """
    queryset = queryset.alias(
        _has_premium_placement=Exists(_active_sponsorship(at=at, placement='best_jobs_eligible')),
        _has_active_sponsorship=Exists(_active_sponsorship(at=at)),
    )
    return queryset.alias(
        commercial_tier_weight=Case(
            When(
                Q(_has_premium_placement=True) | Q(tier=Job.Tier.TOP),
                then=2,
            ),
            When(
                Q(_has_active_sponsorship=True) | Q(tier=Job.Tier.FEATURED),
                then=1,
            ),
            default=0,
            output_field=IntegerField(),
        )
    )


def _with_seeded_rotation(queryset, *, ranking_seed):
    if not ranking_seed:
        return queryset
    return queryset.alias(
        rotation_key=MD5(
            Concat(
                Value(ranking_seed),
                Value(':'),
                Cast('pk', output_field=CharField()),
            )
        )
    )


def _commercial_ordering(*, ranking_seed):
    ordering = ['-commercial_tier_weight']
    if getattr(settings, 'JOB_PROMOTION_REFRESH_ENABLED', False):
        ordering.extend(
            [
                F('latest_refresh_at').desc(nulls_last=True),
                F('latest_refresh_event_id').desc(nulls_last=True),
            ]
        )
    if ranking_seed:
        ordering.append('rotation_key')
    ordering.extend(['-lifecycle_recency', '-created_at', '-id'])
    return ordering


def distribute_sponsored_job_page(
    queryset,
    *,
    page,
    page_size,
    at=None,
    ranking_seed='',
):
    """Return one paid-tier-first page for the default candidate feed.

    Commercial priority is a contiguous tier, not a pair of injected positions:
    premium paid jobs, then standard paid jobs, then organic jobs.  Filtering and
    hard relevance have already been applied by the caller.
    """
    at = at or timezone.now()
    page = max(int(page), 1)
    page_size = max(int(page_size), 1)
    ranked = _with_commercial_tier(queryset, at=at)
    ranked = _with_seeded_rotation(ranked, ranking_seed=ranking_seed)
    ranked = ranked.order_by(*_commercial_ordering(ranking_seed=ranking_seed))
    total = ranked.count()
    start = (page - 1) * page_size
    items = list(ranked[start : start + page_size])
    return DistributedJobPage(
        items=items,
        total=total,
        total_pages=ceil(total / page_size) if total else 0,
        page=page,
        page_size=page_size,
    )
