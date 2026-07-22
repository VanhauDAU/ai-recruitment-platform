"""Read queries for administrative job-review operations."""

from ..models import Job


def job_moderation_queryset(*, status=None):
    """Return review-ready jobs without exposing applicant data."""
    queryset = Job.objects.select_related('company', 'posted_by').order_by(
        'submitted_at', 'created_at'
    )
    if status:
        queryset = queryset.filter(status=status)
    return queryset
