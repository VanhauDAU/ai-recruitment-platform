from django.db.models import CharField, Value
from django.db.models.functions import MD5, Cast, Concat
from django.utils import timezone

from ..models import Job
from .listing import filter_job_list_queryset

DEFAULT_BEST_JOBS_ROTATION_SEED = 'homepage-best-jobs'


def build_homepage_best_jobs_queryset(params, *, at=None, rotation_seed=''):
    """Return TOP-tier jobs in a seeded rotation for the home page Best Jobs box.

    The box does not inherit the main feed's recency order; a deterministic seed
    rotates every eligible job so pagination stays stable for one visitor.
    """
    at = at or timezone.now()
    queryset = filter_job_list_queryset(params, include_preview=True, at=at).filter(
        tier=Job.Tier.TOP
    )
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
