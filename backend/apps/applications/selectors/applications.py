"""Read queries for job applications."""

from django.db.models import Q

from ..models import Application


def candidate_applications_queryset(candidate):
    return (
        Application.objects.filter(candidate=candidate)
        .select_related('job', 'cv', 'submitted_cv_version')
        .prefetch_related('preferred_locations')
        .order_by('-applied_at')
    )


def employer_applications_queryset(employer, job_public_id=None):
    queryset = (
        Application.objects.filter(job__posted_by=employer)
        .select_related(
            'job',
            'cv',
            'submitted_cv_version',
            'submitted_cv_version__template_version',
        )
        .prefetch_related(
            'preferred_locations',
        )
    )
    if job_public_id:
        queryset = queryset.filter(job__public_id=job_public_id)
    return queryset.order_by('-applied_at')


def employer_application_queryset(employer):
    """Applications an employer is authorised to update."""
    return Application.objects.filter(job__posted_by=employer)


def recruiter_application_snapshot_queryset(recruiter):
    """Snapshots readable by a job poster or a linked company member."""
    return (
        Application.objects.filter(
            Q(job__posted_by=recruiter)
            | Q(
                job__company__recruiters__user=recruiter,
            ),
            submitted_cv_version__version_kind='application_snapshot',
        )
        .select_related(
            'job',
            'submitted_cv_version',
            'submitted_cv_version__template_version',
            'submitted_cv_version__parent_version',
        )
        .prefetch_related('preferred_locations')
        .distinct()
    )
