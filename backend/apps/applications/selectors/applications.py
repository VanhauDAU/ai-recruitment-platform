"""Read queries for job applications."""

from ..models import Application


def candidate_applications_queryset(candidate):
    return Application.objects.filter(candidate=candidate).select_related('job', 'cv').order_by('-applied_at')


def employer_applications_queryset(employer, job_public_id=None):
    queryset = Application.objects.filter(job__posted_by=employer).select_related('job', 'cv')
    if job_public_id:
        queryset = queryset.filter(job__public_id=job_public_id)
    return queryset.order_by('-applied_at')


def employer_application_queryset(employer):
    """Applications an employer is authorised to update."""
    return Application.objects.filter(job__posted_by=employer)
