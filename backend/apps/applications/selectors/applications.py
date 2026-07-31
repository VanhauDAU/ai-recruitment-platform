"""Read queries for job applications."""

from django.db.models import OuterRef, Q, Subquery

from ..models import Application


def candidate_applications_queryset(candidate):
    return (
        Application.objects.filter(candidate=candidate)
        .select_related('job', 'job__company', 'cv', 'submitted_cv_version')
        .prefetch_related('preferred_locations', 'status_history')
        .order_by('-applied_at')
    )


def employer_applications_queryset(
    employer,
    job_public_id=None,
    *,
    status=None,
    campaign=None,
    q=None,
    scope=None,
    ordering=None,
    latest_only=False,
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
            Q(candidate__full_name__icontains=q)
            | Q(candidate__email__icontains=q)
            | Q(job__title__icontains=q)
            | Q(submitted_cv_title__icontains=q)
        )
    if latest_only:
        latest_application_id = (
            Application.objects.filter(
                candidate_id=OuterRef('candidate_id'),
                job_id=OuterRef('job_id'),
            )
            .order_by('-applied_at', '-id')
            .values('id')[:1]
        )
        queryset = queryset.filter(id=Subquery(latest_application_id))
    if scope == 'unread':
        queryset = queryset.filter(status=Application.Status.SUBMITTED)
    elif scope == 'unanswered':
        queryset = queryset.filter(
            status__in=[
                Application.Status.SUBMITTED,
                Application.Status.VIEWED,
                Application.Status.CONSIDERING,
            ]
        )
    order_fields = {
        'oldest': 'applied_at',
        'name': 'candidate__full_name',
        'newest': '-applied_at',
    }
    return queryset.order_by(order_fields.get(ordering, '-applied_at'), '-id')


def employer_application_queryset(employer):
    """Applications an employer is authorised to update."""
    return Application.objects.filter(job__posted_by=employer)


def admin_job_applications_queryset(job, *, params=None):
    """Return read-only application records for one job moderation workspace."""
    params = params or {}
    queryset = (
        Application.objects.filter(job=job)
        .select_related('candidate', 'job', 'submitted_cv_version')
        .prefetch_related('preferred_locations')
    )

    if query := (params.get('q') or '').strip():
        queryset = queryset.filter(
            Q(candidate__full_name__icontains=query)
            | Q(candidate__email__icontains=query)
            | Q(contact_name__icontains=query)
            | Q(contact_email__icontains=query)
            | Q(contact_phone__icontains=query)
            | Q(submitted_cv_title__icontains=query)
        )
    if status_values := [value for value in (params.get('status') or '').split(',') if value]:
        queryset = queryset.filter(status__in=status_values)
    if source := params.get('source'):
        queryset = queryset.filter(source=source)
    if submitted_from := params.get('submitted_from'):
        queryset = queryset.filter(applied_at__date__gte=submitted_from)
    if submitted_to := params.get('submitted_to'):
        queryset = queryset.filter(applied_at__date__lte=submitted_to)

    ordering = {
        'oldest': 'applied_at',
        'name': 'candidate__full_name',
        'status': 'status',
        'newest': '-applied_at',
    }.get(params.get('ordering'), '-applied_at')
    return queryset.order_by(ordering, '-id')


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
