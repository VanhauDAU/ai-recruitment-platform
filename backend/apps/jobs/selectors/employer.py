"""Read queries owned by an employer for the jobs domain."""

from ..models import Job


def employer_jobs_queryset(user):
    """Return all serializer relations for the authenticated employer's jobs."""
    return (
        Job.objects.filter(posted_by=user)
        .select_related('company')
        .prefetch_related(
            'category_assignments__category',
            'job_locations__location__parent',
            'job_skills__skill',
            'work_schedules',
            'job_benefits__benefit',
            'language_requirements__language',
            'application_contact__emails',
        )
        .order_by('-created_at')
    )
