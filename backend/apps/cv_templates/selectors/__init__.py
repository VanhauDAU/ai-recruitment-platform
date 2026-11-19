"""Public read queries for CV templates and position-driven preview content."""

from .admin import (
    admin_categories_queryset,
    admin_colors_queryset,
    admin_position_fields_queryset,
    admin_position_profiles_queryset,
    admin_sample_contents_queryset,
    admin_sample_generations_queryset,
    admin_template_version,
    admin_templates_queryset,
    template_version,
)
from .backgrounds import active_backgrounds_queryset, admin_backgrounds_queryset
from .stats import cv_admin_overview
from .templates import (
    active_cv_categories_queryset,
    active_cv_position_options_queryset,
    active_position_profile,
    preview_template,
    published_sample_contents_queryset,
    published_template_detail_queryset,
    published_template_queryset,
    related_published_templates,
)

__all__ = [
    'active_backgrounds_queryset',
    'admin_backgrounds_queryset',
    'admin_categories_queryset',
    'admin_colors_queryset',
    'admin_position_fields_queryset',
    'admin_position_profiles_queryset',
    'admin_sample_contents_queryset',
    'admin_sample_generations_queryset',
    'admin_template_version',
    'admin_templates_queryset',
    'template_version',
    'cv_admin_overview',
    'active_cv_categories_queryset',
    'active_cv_position_options_queryset',
    'active_position_profile',
    'preview_template',
    'published_sample_contents_queryset',
    'published_template_detail_queryset',
    'published_template_queryset',
    'related_published_templates',
]
