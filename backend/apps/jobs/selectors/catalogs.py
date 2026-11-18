"""Public catalogues the job form and search filters pick from."""

from ..models import Benefit, JobCategory, Language


def active_job_categories_queryset(*, category_type=None):
    queryset = JobCategory.objects.filter(status=JobCategory.Status.ACTIVE).only(
        'id',
        'name',
        'logo_url',
        'parent_id',
        'category_type',
    )
    if category_type:
        queryset = queryset.filter(category_type=category_type)
    return queryset


def active_benefits_queryset():
    return Benefit.objects.filter(is_active=True)


def active_languages_queryset():
    return Language.objects.filter(is_active=True)
