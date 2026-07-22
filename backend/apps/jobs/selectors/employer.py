"""Read queries owned by an employer for the jobs domain."""

from django.db.models import BooleanField, Case, Q, Value, When
from django.utils import timezone

from ..models import Job


def employer_job_list_queryset(user, *, status=None, campaign=None, q=None):
    """Compact query for the employer management table."""
    queryset = (
        Job.objects.filter(posted_by=user)
        .select_related('company', 'campaign')
        .prefetch_related('job_locations__location__parent')
        .defer(
            'description',
            'requirements',
            'benefits',
            'work_schedule_note',
        )
        .annotate(
            is_expired_value=Case(
                When(status=Job.Status.ACTIVE, deadline__lt=timezone.localdate(), then=Value(True)),
                default=Value(False),
                output_field=BooleanField(),
            )
        )
        .order_by('-created_at')
    )
    if status == 'expired':
        queryset = queryset.filter(status=Job.Status.ACTIVE, deadline__lt=timezone.localdate())
    elif status:
        queryset = queryset.filter(status=status)
        if status == Job.Status.ACTIVE:
            queryset = queryset.filter(
                Q(deadline__isnull=True) | Q(deadline__gte=timezone.localdate())
            )
    if campaign:
        queryset = queryset.filter(campaign__public_id=campaign)
    if q:
        queryset = queryset.filter(title__icontains=q.strip())
    return queryset


def employer_job_detail_queryset(user):
    """Full form query for one employer-owned job."""
    return (
        Job.objects.filter(posted_by=user)
        .select_related('company', 'campaign')
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
