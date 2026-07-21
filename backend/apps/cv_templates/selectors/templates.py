"""Read queries for public CV templates."""

from django.db.models import Prefetch, Q

from apps.jobs.models import JobCategory, JobCategoryLocalization

from ..models import (
    CvCategory,
    CvContentBlueprint,
    CvSampleContent,
    CvTemplate,
    CvTemplateCategoryLink,
    CvTemplateColorLink,
    CvTemplateLocalization,
    CvTemplateSection,
)


def active_cv_templates_queryset():
    return CvTemplate.objects.filter(status=CvTemplate.Status.ACTIVE)


def _slugs(value):
    return [slug.strip() for slug in (value or '').split(',') if slug.strip()]


def published_template_queryset(*, locale='vi-VN', category=None, tag=None):
    """Public catalogue, always tied to the current published version."""
    localizations = CvTemplateLocalization.objects.filter(locale=locale, is_active=True)
    categories = (
        CvTemplateCategoryLink.objects.select_related('category')
        .filter(
            category__is_active=True,
        )
        .order_by('sort_order', 'category__sort_order', 'category__name')
    )
    colors = (
        CvTemplateColorLink.objects.select_related('color')
        .filter(
            color__is_active=True,
        )
        .order_by('sort_order', 'color__sort_order', 'color__name')
    )
    queryset = (
        CvTemplate.objects.filter(
            status=CvTemplate.Status.ACTIVE,
            lifecycle_status=CvTemplate.LifecycleStatus.PUBLISHED,
            current_published_version__version_status='published',
            localizations__locale=locale,
            localizations__is_active=True,
        )
        .select_related('current_published_version')
        .prefetch_related(
            Prefetch('localizations', queryset=localizations, to_attr='catalog_localizations'),
            Prefetch('category_links', queryset=categories, to_attr='catalog_category_links'),
            Prefetch('color_links', queryset=colors, to_attr='catalog_color_links'),
        )
    )
    category_slugs = _slugs(category)
    if category_slugs:
        queryset = queryset.filter(
            category_links__category__slug__in=category_slugs,
            category_links__category__category_type__in=[
                CvCategory.CategoryType.STYLE,
                CvCategory.CategoryType.POSITION,
                CvCategory.CategoryType.AUDIENCE,
            ],
        )
    tag_slugs = _slugs(tag)
    if tag_slugs:
        queryset = queryset.filter(
            category_links__category__slug__in=tag_slugs,
            category_links__category__category_type=CvCategory.CategoryType.FEATURE,
        )
    return queryset.distinct()


def published_template_detail_queryset(locale='vi-VN'):
    return published_template_queryset(locale=locale).prefetch_related(
        Prefetch(
            'current_published_version__sections',
            queryset=CvTemplateSection.objects.select_related('section_definition'),
            to_attr='catalog_sections',
        ),
    )


def active_cv_categories_queryset(category_type=None):
    queryset = CvCategory.objects.filter(is_active=True)
    if category_type:
        queryset = queryset.filter(category_type=category_type)
    return queryset


def published_sample_contents_queryset(*, locale=None, experience_level=None):
    queryset = CvSampleContent.objects.filter(
        status=CvSampleContent.Status.PUBLISHED
    ).select_related('job_category')
    if locale:
        queryset = queryset.filter(locale=locale)
    if experience_level:
        queryset = queryset.filter(experience_level=experience_level)
    return queryset


def active_cv_position_options_queryset(
    query=None,
    *,
    locale=JobCategoryLocalization.Locale.VI,
    experience_level='unspecified',
):
    selected_localizations = JobCategoryLocalization.objects.filter(
        locale=locale,
        is_active=True,
    )
    vi_localizations = JobCategoryLocalization.objects.filter(
        locale=JobCategoryLocalization.Locale.VI,
        is_active=True,
    )
    queryset = JobCategory.objects.filter(
        status=JobCategory.Status.ACTIVE,
        category_type=JobCategory.CategoryType.SPECIALIZATION,
        localizations__locale=locale,
        localizations__is_active=True,
    ).prefetch_related(
        Prefetch(
            'localizations', queryset=selected_localizations, to_attr='cv_picker_localizations'
        ),
        Prefetch('localizations', queryset=vi_localizations, to_attr='cv_picker_vi_localizations'),
    )
    has_blueprint = CvContentBlueprint.objects.filter(
        locale=locale,
        experience_level__in=[experience_level, 'unspecified'],
        is_active=True,
    ).exists()
    if not has_blueprint:
        queryset = queryset.filter(
            cv_sample_contents__locale=locale,
            cv_sample_contents__experience_level=experience_level,
            cv_sample_contents__status=CvSampleContent.Status.PUBLISHED,
        )
    if query:
        queryset = queryset.filter(
            Q(localizations__display_name__unaccent__icontains=query)
            | Q(localizations__search_aliases__unaccent__icontains=query)
        )
    return queryset.distinct().order_by(
        'localizations__sort_order',
        'localizations__display_name',
        'pk',
    )


def related_published_templates(template, *, locale='vi-VN', limit=6):
    category_slugs = [
        link.category.slug
        for link in getattr(template, 'catalog_category_links', [])
        if link.category.category_type != CvCategory.CategoryType.FEATURE
    ]
    queryset = published_template_queryset(locale=locale).exclude(pk=template.pk)
    if category_slugs:
        queryset = queryset.filter(
            category_links__category__slug__in=category_slugs,
            category_links__category__category_type__in=[
                CvCategory.CategoryType.STYLE,
                CvCategory.CategoryType.POSITION,
                CvCategory.CategoryType.AUDIENCE,
            ],
        ).distinct()
    return queryset.order_by('-usage_count', 'sort_order', 'name')[:limit]
