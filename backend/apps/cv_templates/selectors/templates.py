"""Read queries for public CV templates."""

from ..models import CvTemplate


def active_cv_templates_queryset():
    return CvTemplate.objects.filter(status=CvTemplate.Status.ACTIVE)
