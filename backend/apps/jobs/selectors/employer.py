"""Read queries owned by an employer for the jobs domain."""

from ..models import Job


def employer_job_list_queryset(user):
    """Compact query for the employer management table."""
    return (
        Job.objects.filter(posted_by=user)
        .select_related('company')
        .prefetch_related('job_locations__location__parent')
        .defer(
            'description', 'requirements', 'benefits', 'work_schedule_note',
            'rejected_reason',
        )
        .order_by('-created_at')
    )


def employer_job_detail_queryset(user):
    """Full form query for one employer-owned job."""
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
