from django.db.models import Case, F, IntegerField, Q, When
from django.db.models.functions import Coalesce
from rest_framework.exceptions import ValidationError

from common.db.search import search_q

from ..models import Job, JobCategory


SALARY_BUCKETS = [
    ('u10', 'Dưới 10 triệu', None, 10_000_000),
    ('10-15', '10 - 15 triệu', 10_000_000, 15_000_000),
    ('15-20', '15 - 20 triệu', 15_000_000, 20_000_000),
    ('20-25', '20 - 25 triệu', 20_000_000, 25_000_000),
    ('25-30', '25 - 30 triệu', 25_000_000, 30_000_000),
    ('30-50', '30 - 50 triệu', 30_000_000, 50_000_000),
    ('o50', 'Trên 50 triệu', 50_000_000, None),
]
TRUTHY_VALUES = {'1', 'true', 'True'}


def filter_salary_bucket(queryset, bucket_key):
    """Filter jobs by the upper value displayed for a salary band."""
    bucket = next((item for item in SALARY_BUCKETS if item[0] == bucket_key), None)
    if not bucket:
        raise ValidationError({'salary_bucket': 'Invalid salary bucket.'})

    _, _, lower, upper = bucket
    queryset = (
        queryset.exclude(salary_type=Job.SalaryType.NEGOTIABLE)
        .exclude(salary_min__isnull=True, salary_max__isnull=True)
        .annotate(salary_bucket_value=Coalesce('salary_max', 'salary_min'))
    )
    if lower is not None:
        queryset = queryset.filter(salary_bucket_value__gt=lower)
    if upper is not None:
        queryset = queryset.filter(salary_bucket_value__lte=upper)
    return queryset


def active_jobs_queryset():
    return (
        Job.objects.filter(status=Job.Status.ACTIVE)
        .select_related('company')
        .prefetch_related(
            'category_assignments__category',
            'job_locations__location__parent',
            'job_skills__skill',
            'job_benefits__benefit',
        )
    )


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
    if salary_gte := params.get('salary_gte'):
        queryset = queryset.filter(
            Q(salary_max__gte=salary_gte)
            | Q(salary_max__isnull=True, salary_min__gte=salary_gte)
        )
    if salary_lte := params.get('salary_lte'):
        queryset = queryset.filter(
            Q(salary_min__lte=salary_lte)
            | Q(salary_min__isnull=True, salary_max__lte=salary_lte)
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
            search_q('title', search)
            | search_q('company__company_name', search)
        )
    return queryset.filter(search_q('title', search))


def _order_jobs(queryset, ordering):
    if ordering == 'salary_desc':
        return queryset.order_by(F('salary_max').desc(nulls_last=True), '-published_at')
    tier_weight = Case(
        When(tier=Job.Tier.TOP, then=2),
        When(tier=Job.Tier.FEATURED, then=1),
        default=0,
        output_field=IntegerField(),
    )
    return queryset.annotate(tier_weight=tier_weight).order_by(
        '-tier_weight', '-published_at', '-created_at'
    )


def build_job_list_queryset(params):
    """Apply public job-list filters and ordering to the active job queryset."""
    queryset = active_jobs_queryset()
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
    return _order_jobs(queryset, params.get('ordering'))
