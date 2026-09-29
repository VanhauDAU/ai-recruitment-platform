from django.conf import settings
from django.db.models import (
    BigIntegerField,
    Case,
    DateTimeField,
    F,
    IntegerField,
    OuterRef,
    Q,
    Subquery,
    When,
)
from django.db.models.functions import Coalesce
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.services.models import JobServiceUsageEvent
from common.db.search import fold_accents, search_q

from ..models import Job, JobCategory
from ..models.querysets import (
    SALARY_BUCKETS,
    active_jobs_queryset,
    filter_salary_bucket_queryset,
    publicly_available_job_filter,
)
from .presentation import with_effective_service_presentations

__all__ = [
    'SALARY_BUCKETS',
    'active_jobs_queryset',
    'filter_job_list_queryset',
    'filter_salary_bucket',
    'publicly_available_job_filter',
]

TRUTHY_VALUES = {'1', 'true', 'True'}
JOB_LIST_ORDERINGS = {'newest', 'salary_desc', 'urgent'}


def filter_salary_bucket(queryset, bucket_key):
    """Filter jobs by the upper value displayed for a salary band."""
    try:
        return filter_salary_bucket_queryset(queryset, bucket_key)
    except ValueError as error:
        raise ValidationError({'salary_bucket': 'Invalid salary bucket.'}) from error


def active_job_detail_queryset():
    """Return active jobs with every relation required by the detail serializer."""
    queryset = (
        Job.objects.filter(publicly_available_job_filter())
        .select_related('company', 'campaign', 'posted_by', 'posted_by__recruiter_profile')
        .prefetch_related(
            'category_assignments__category',
            'job_locations__location__parent',
            'job_skills__skill',
            'work_schedules',
            'job_benefits__benefit',
            'language_requirements__language',
            'company__industries',
        )
    )
    return with_effective_service_presentations(queryset)


def active_job_tracking_queryset(slugs):
    """Return only privacy-safe fields required by the engagement write path."""
    return Job.objects.filter(publicly_available_job_filter(), slug__in=slugs).only('id', 'slug')


def suggest_job_search_terms(query, search_by=None, limit=10):
    """Return de-duplicated autocomplete terms, prioritising prefix matches."""
    query = (query or '').strip()
    if not query:
        return []

    field = 'company__company_name' if search_by == 'company' else 'title'
    values = (
        Job.objects.filter(publicly_available_job_filter())
        .filter(search_q(field, query))
        .values_list(field, flat=True)
        .distinct()
    )
    normalized_query = fold_accents(query)
    seen, starts, contains = set(), [], []
    for value in values:
        term = (value or '').strip()
        normalized_term = fold_accents(term)
        if not term or normalized_term in seen:
            continue
        seen.add(normalized_term)
        (starts if normalized_term.startswith(normalized_query) else contains).append(term)
    return (starts + contains)[:limit]


def _filter_categories(queryset, category_values):
    category_ids = [int(value) for value in category_values if value.isdigit()]
    children = list(
        JobCategory.objects.filter(parent_id__in=category_ids).values_list('id', flat=True)
    )
    grandchildren = list(
        JobCategory.objects.filter(parent_id__in=children).values_list('id', flat=True)
    )
    return queryset.filter(
        category_assignments__category_id__in=[*category_ids, *children, *grandchildren]
    ).distinct()


def _filter_salary(queryset, params):
    if params.get('salary_negotiable') in TRUTHY_VALUES:
        return queryset.filter(salary_type=Job.SalaryType.NEGOTIABLE)
    if salary_bucket := params.get('salary_bucket'):
        return filter_salary_bucket(queryset, salary_bucket)
    if params.get('salary_gte') or params.get('salary_lte'):
        queryset = (
            queryset.filter(currency=Job.Currency.VND)
            .exclude(salary_type=Job.SalaryType.NEGOTIABLE)
            .exclude(salary_min__isnull=True, salary_max__isnull=True)
        )
    if salary_gte := params.get('salary_gte'):
        queryset = queryset.filter(
            Q(salary_max__gte=salary_gte) | Q(salary_max__isnull=True, salary_min__gte=salary_gte)
        )
    if salary_lte := params.get('salary_lte'):
        queryset = queryset.filter(
            Q(salary_min__lte=salary_lte) | Q(salary_min__isnull=True, salary_max__lte=salary_lte)
        )
    return queryset


def _filter_search(queryset, params):
    search = params.get('search')
    if not search:
        return queryset
    search_by = params.get('search_by', 'title')
    if search_by == 'company':
        return queryset.filter(search_q('company__company_name', search))
    if search_by == 'both':
        return queryset.filter(
            search_q('title', search) | search_q('company__company_name', search)
        )
    return queryset.filter(search_q('title', search))


def _with_latest_refresh(queryset, *, at=None):
    """Annotate the independent refresh clock used by the default job feed.

    A refresh is append-only commercial evidence.  It must never rewrite the
    publication/lifecycle clock, and refreshing another job must not erase the
    previous job's rank.  The event id is the deterministic tie-breaker when two
    actions share the same timestamp (for example in a bulk operation).
    """
    if not getattr(settings, 'JOB_PROMOTION_REFRESH_ENABLED', False):
        return queryset

    at = at or timezone.now()
    latest_refresh = JobServiceUsageEvent.objects.filter(
        job_id=OuterRef('pk'),
        event_type=JobServiceUsageEvent.EventType.REFRESH,
        activation__status='active',
        activation__starts_at__lte=at,
        activation__ends_at__gt=at,
        activation_item__starts_at__lte=at,
        activation_item__ends_at__gt=at,
        occurred_at__lte=at,
    ).order_by('-occurred_at', '-id')
    return queryset.alias(
        latest_refresh_at=Subquery(
            latest_refresh.values('occurred_at')[:1],
            output_field=DateTimeField(),
        ),
        latest_refresh_event_id=Subquery(
            latest_refresh.values('id')[:1],
            output_field=BigIntegerField(),
        ),
    ).alias(effective_recency=Coalesce('latest_refresh_at', 'lifecycle_recency'))


def _order_jobs(queryset, ordering, *, at=None):
    if ordering and ordering not in JOB_LIST_ORDERINGS:
        raise ValidationError({'ordering': 'Invalid ordering.'})

    queryset = queryset.annotate(
        lifecycle_recency=Coalesce('first_approved_at', 'published_at', 'created_at')
    )
    if ordering == 'newest':
        return queryset.order_by('-lifecycle_recency', '-created_at', '-id')
    if ordering == 'salary_desc':
        return queryset.order_by(
            F('salary_max').desc(nulls_last=True), '-lifecycle_recency', '-created_at', '-id'
        )
    if ordering == 'urgent':
        return queryset.order_by('-is_urgent', '-lifecycle_recency', '-created_at', '-id')
    tier_weight = Case(
        When(tier=Job.Tier.TOP, then=2),
        When(tier=Job.Tier.FEATURED, then=1),
        default=0,
        output_field=IntegerField(),
    )
    queryset = queryset.annotate(tier_weight=tier_weight)
    if not getattr(settings, 'JOB_PROMOTION_REFRESH_ENABLED', False):
        return queryset.order_by('-tier_weight', '-lifecycle_recency', '-created_at', '-id')

    # Legacy tiers remain paid-first even while commercial distribution is behind
    # its kill switch. Within one tier, a later refresh B is above A while A keeps
    # its own timestamp; a genuinely newer publication can still move ahead.
    return _with_latest_refresh(queryset, at=at).order_by(
        '-tier_weight',
        '-effective_recency',
        F('latest_refresh_event_id').desc(nulls_last=True),
        '-lifecycle_recency',
        '-created_at',
        '-id',
    )


def filter_job_list_queryset(params, include_preview=False, *, at=None):
    """Apply the public filters shared by candidate job-list surfaces."""
    queryset = with_effective_service_presentations(
        active_jobs_queryset(include_preview=include_preview, at=at),
        at=at,
    )
    if categories := params.getlist('category'):
        queryset = _filter_categories(queryset, categories)
    if locations := params.getlist('location'):
        queryset = queryset.filter(
            Q(job_locations__location_id__in=locations)
            | Q(job_locations__location__parent_id__in=locations)
        ).distinct()

    scalar_filters = {
        'work_type': 'work_type',
        'employment_type': 'employment_type',
        'education_level': 'education_level',
        'position_level': 'position_level',
        'industry': 'company__industries__id',
    }
    for param_name, model_field in scalar_filters.items():
        if value := params.get(param_name):
            queryset = queryset.filter(**{model_field: value})

    if experience_years := params.getlist('experience_years'):
        queryset = queryset.filter(experience_years__in=experience_years)
    if params.get('flash_badge') in TRUTHY_VALUES:
        queryset = queryset.filter(has_flash_badge=True)

    queryset = _filter_salary(queryset, params)
    queryset = _filter_search(queryset, params)
    return queryset


def build_job_list_queryset(params, include_preview=False, *, at=None):
    """Apply public job-list filters and the main search-feed ordering."""
    queryset = filter_job_list_queryset(params, include_preview=include_preview, at=at)
    return _order_jobs(queryset, params.get('ordering'), at=at)
