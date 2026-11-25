from django.db.models import BooleanField, Case, F, IntegerField, OuterRef, Q, Subquery, Value, When
from rest_framework.exceptions import ValidationError

from apps.employers.models import CompanyPinnedJob
from common.db.search import fold_accents, folded_search_q

from ..models import Job, JobCategory
from ..models.querysets import (
    SALARY_BUCKETS,
    active_jobs_queryset,
    filter_salary_bucket_queryset,
    listing_recency,
    publicly_available_job_filter,
    stopped_job_filter,
)

__all__ = [
    'SALARY_BUCKETS',
    'active_jobs_queryset',
    'filter_job_list_queryset',
    'filter_salary_bucket',
    'publicly_available_job_filter',
]

TRUTHY_VALUES = {'1', 'true', 'True'}
JOB_LIST_ORDERINGS = {'newest', 'salary_desc', 'closing_soon'}


def filter_salary_bucket(queryset, bucket_key):
    """Filter jobs by the upper value displayed for a salary band."""
    try:
        return filter_salary_bucket_queryset(queryset, bucket_key)
    except ValueError as error:
        raise ValidationError({'salary_bucket': 'Invalid salary bucket.'}) from error


def job_detail_queryset():
    """Public jobs plus jobs that stopped recruiting, for the candidate detail page.

    ``accepting_applications`` tells them apart: a stopped job is shown with
    "Hết hạn ứng tuyển" instead of the apply action.
    """
    public = publicly_available_job_filter()
    return _with_detail_relations(Job.objects.filter(public | stopped_job_filter())).annotate(
        accepting_applications=Case(
            When(public, then=Value(True)), default=Value(False), output_field=BooleanField()
        )
    )


def public_jobs_queryset():
    """Jobs candidates can act on now (save, report), without extra relations."""
    return Job.objects.filter(publicly_available_job_filter())


def active_job_detail_queryset():
    """Return active jobs with every relation required by the detail serializer."""
    return _with_detail_relations(Job.objects.filter(publicly_available_job_filter()))


def _with_detail_relations(queryset):
    return queryset.select_related(
        'company', 'campaign', 'posted_by', 'posted_by__recruiter_profile'
    ).prefetch_related(
        'category_assignments__category',
        'job_locations__location__parent',
        'job_skills__skill',
        'work_schedules',
        'job_benefits__benefit',
        'language_requirements__language',
        'company__industries',
    )


def active_job_tracking_queryset(slugs):
    """Return only privacy-safe fields required by the engagement write path."""
    return Job.objects.filter(publicly_available_job_filter(), slug__in=slugs).only('id', 'slug')


# Autocomplete reads at most this many distinct terms, prefix matches first,
# instead of every matching job title.
SUGGEST_SCAN_LIMIT = 50


def suggest_job_search_terms(query, search_by=None, limit=10):
    """Return de-duplicated autocomplete terms, prioritising prefix matches."""
    query = (query or '').strip()
    if not query:
        return []

    if search_by == 'company':
        field, folded_field = 'company__company_name', 'company__company_name_search'
    else:
        field, folded_field = 'title', 'title_search'
    normalized_query = fold_accents(query)
    values = (
        Job.objects.filter(publicly_available_job_filter())
        .filter(folded_search_q(folded_field, query))
        .annotate(
            suggest_rank=Case(
                When(**{f'{folded_field}__startswith': normalized_query}, then=Value(0)),
                default=Value(1),
                output_field=IntegerField(),
            )
        )
        .order_by('suggest_rank', field)
        .values_list(field, flat=True)
        .distinct()[:SUGGEST_SCAN_LIMIT]
    )
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
    title = folded_search_q('title_search', search)
    company = folded_search_q('company__company_name_search', search)
    if search_by == 'company':
        return queryset.filter(company)
    if search_by == 'both':
        return queryset.filter(title | company)
    return queryset.filter(title)


def _order_jobs(queryset, ordering, *, pinned_first=False):
    """Organic order only (ADR-0030): newest first by first publication.

    ``pinned_first`` puts a company's pinned jobs ahead of the default order on
    its own page; an explicit ``ordering`` always wins over the pins.
    """
    if ordering and ordering not in JOB_LIST_ORDERINGS:
        raise ValidationError({'ordering': 'Invalid ordering.'})

    queryset = queryset.annotate(listing_recency=listing_recency())
    newest = ['-listing_recency', '-created_at', '-id']
    if ordering == 'salary_desc':
        return queryset.order_by(F('salary_max').desc(nulls_last=True), *newest)
    if ordering == 'closing_soon':
        return queryset.order_by(F('deadline').asc(nulls_last=True), *newest)
    if ordering or not pinned_first:
        return queryset.order_by(*newest)
    pin = CompanyPinnedJob.objects.filter(job_id=OuterRef('pk'), company_id=OuterRef('company_id'))
    return queryset.annotate(pin_order=Subquery(pin.values('sort_order')[:1])).order_by(
        F('pin_order').asc(nulls_last=True), *newest
    )


def filter_job_list_queryset(params, include_preview=False, *, at=None):
    """Apply the public filters shared by candidate job-list surfaces."""
    queryset = active_jobs_queryset(include_preview=include_preview, at=at)
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
        'company': 'company__public_id',
        'campaign': 'campaign__public_id',
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
    return _order_jobs(
        queryset,
        params.get('ordering'),
        pinned_first=bool(params.get('company')),
    )
