"""Read queries for public CV templates."""

from django.db.models import Prefetch

from ..models import (
    CvCategory,
    CvSampleContent,
    CvTemplate,
    CvTemplateCategoryLink,
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
    categories = CvTemplateCategoryLink.objects.select_related('category').filter(category__is_active=True)
    queryset = CvTemplate.objects.filter(
        status=CvTemplate.Status.ACTIVE,
        lifecycle_status=CvTemplate.LifecycleStatus.PUBLISHED,
        current_published_version__version_status='published',
        localizations__locale=locale,
        localizations__is_active=True,
    ).select_related('current_published_version').prefetch_related(
        Prefetch('localizations', queryset=localizations, to_attr='catalog_localizations'),
        Prefetch('category_links', queryset=categories, to_attr='catalog_category_links'),
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
    queryset = CvSampleContent.objects.filter(status=CvSampleContent.Status.PUBLISHED).select_related('job_category')
    if locale:
        queryset = queryset.filter(locale=locale)
    if experience_level:
        queryset = queryset.filter(experience_level=experience_level)
    return queryset


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
