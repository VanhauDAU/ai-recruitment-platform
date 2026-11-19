"""Request-field lookups shared by the CV create and import contracts."""

from rest_framework import serializers

from apps.cv_templates.models import CvTemplate
from apps.jobs.models import JobCategory

THEME_COLOR_PATTERN = r'^#[0-9A-Fa-f]{6}$'


def template_by_public_id(value):
    try:
        return CvTemplate.objects.select_related('current_published_version').get(public_id=value)
    except CvTemplate.DoesNotExist as error:
        raise serializers.ValidationError('Unknown template.') from error


def active_specialization(value):
    try:
        return JobCategory.objects.get(
            public_id=value,
            status=JobCategory.Status.ACTIVE,
            category_type=JobCategory.CategoryType.SPECIALIZATION,
        )
    except JobCategory.DoesNotExist as error:
        raise serializers.ValidationError('Unknown active specialization.') from error


def normalize_theme_color(attrs, template):
    """Only a color of the template's active palette is accepted, stored upper-case."""
    theme_color = attrs.get('theme_color')
    if not theme_color:
        return
    if not template.offers_color(theme_color):
        raise serializers.ValidationError(
            {'theme_color': 'Color is not available for this template.'}
        )
    attrs['theme_color'] = theme_color.upper()
