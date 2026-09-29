from django.conf import settings
from django.db.models import CharField, Exists, OuterRef, Q, Value
from django.db.models.functions import MD5, Cast, Concat
from django.utils import timezone

from apps.services.models import JobServiceActivationItem, ServiceCapability

from ..models import Job
from .listing import filter_job_list_queryset

DEFAULT_BEST_JOBS_ROTATION_SEED = 'homepage-best-jobs'


def _active_best_jobs_placement(*, at):
    return JobServiceActivationItem.objects.filter(
        activation__job_id=OuterRef('pk'),
        activation__status='active',
        activation__starts_at__lte=at,
        activation__ends_at__gt=at,
        capability__code=ServiceCapability.Code.SPONSORED_PLACEMENT,
        configuration__placement='best_jobs_eligible',
        starts_at__lte=at,
        ends_at__gt=at,
    )


def build_homepage_best_jobs_queryset(params, *, at=None, rotation_seed=''):
    """Return the independently rotated eligibility pool for the home page.

    This surface deliberately does not inherit paid-tier or refresh ranking from
    the main search feed. Commercial capability is an admission rule only; a
    deterministic seed then rotates all eligible jobs for stable pagination.
    """
    at = at or timezone.now()
    queryset = filter_job_list_queryset(params, include_preview=True, at=at)
    if getattr(settings, 'JOB_PRESENTATION_V2_ENABLED', False):
        queryset = queryset.alias(
            _has_best_jobs_placement=Exists(_active_best_jobs_placement(at=at))
        ).filter(Q(_has_best_jobs_placement=True) | Q(tier=Job.Tier.TOP))
    else:
        queryset = queryset.filter(tier=Job.Tier.TOP)

    seed = rotation_seed or DEFAULT_BEST_JOBS_ROTATION_SEED
    return queryset.alias(
        homepage_rotation_key=MD5(
            Concat(
                Value(seed),
                Value(':'),
                Cast('pk', output_field=CharField()),
            )
        )
    ).order_by('homepage_rotation_key', 'id')
