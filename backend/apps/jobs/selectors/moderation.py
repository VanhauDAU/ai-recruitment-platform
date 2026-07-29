"""Read queries for administrative job-review operations."""

from ..models import Job


def job_moderation_queryset(*, status=None):
    """Return review-ready jobs without exposing applicant data."""
    queryset = (
        Job.objects.filter(
            policy_hold=Job.PolicyHold.NONE,
            posted_by__status='active',
            posted_by__is_active=True,
            posted_by__is_deleted=False,
        )
        .select_related('company', 'posted_by')
        .order_by('submitted_at', 'created_at')
    )
    if status:
        queryset = queryset.filter(status=status)
    return queryset
