"""Jobs a candidate saved (the heart on job cards)."""

from ..models import SavedJob
from .listing import public_jobs_queryset


def candidate_saved_jobs_queryset(candidate):
    """Saved jobs still public, with what the job card shows."""
    return (
        SavedJob.objects.filter(candidate=candidate, job_id__in=public_jobs_queryset().values('pk'))
        .select_related('job__company')
        .prefetch_related(
            'job__category_assignments__category',
            'job__job_locations__location__parent',
            'job__job_skills__skill',
        )
    )


def candidate_saved_job_rows(candidate):
    """Every saved row of the candidate, public or not: unsaving always works."""
    return SavedJob.objects.filter(candidate=candidate)
