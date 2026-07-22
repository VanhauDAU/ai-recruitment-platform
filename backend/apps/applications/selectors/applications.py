"""Read queries for job applications."""

from django.db.models import Q

from ..models import Application


def candidate_applications_queryset(candidate):
    return (
        Application.objects.filter(candidate=candidate)
        .select_related('job', 'cv', 'submitted_cv_version')
        .prefetch_related('preferred_locations', 'status_history')
        .order_by('-applied_at')
    )


def employer_applications_queryset(
    employer, job_public_id=None, *, status=None, campaign=None, q=None
):
    queryset = (
        Application.objects.filter(job__posted_by=employer)
        .select_related(
            'candidate',
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
    if status:
        queryset = queryset.filter(status=status)
    if campaign:
        queryset = queryset.filter(job__campaign__public_id=campaign)
    if q:
        queryset = queryset.filter(
            Q(candidate__full_name__icontains=q) | Q(candidate__email__icontains=q)
        )
    return queryset.order_by('-applied_at')


def employer_application_queryset(employer):
    """Applications an employer is authorised to update."""
    return Application.objects.filter(job__posted_by=employer)


def recruiter_application_snapshot_queryset(recruiter):
    """Snapshots are private to the recruiter who posted the job."""
    return (
        Application.objects.filter(
            Q(job__posted_by=recruiter),
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
