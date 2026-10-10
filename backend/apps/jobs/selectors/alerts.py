from django.db.models import Prefetch

from ..models import JobAlert, JobCategory
from ..models.alert_queries import (
    category_leaf_coverage_ids,
    expanded_category_ids,
    strict_job_alert_matches,
)

__all__ = [
    'candidate_job_alerts',
    'category_leaf_coverage_ids',
    'expanded_category_ids',
    'strict_job_alert_matches',
]


def candidate_job_alerts(user):
    """Return one candidate's alerts with every relation needed by the list DTO."""
    return (
        JobAlert.objects.filter(candidate=user)
        .select_related('province', 'ward')
        .prefetch_related(
            Prefetch('categories', queryset=JobCategory.objects.order_by('name', 'pk'))
        )
    )
