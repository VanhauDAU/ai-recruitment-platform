"""Pure job-query primitives shared by selectors and delivery services."""

from django.conf import settings
from django.db.models import F, Q
from django.db.models.functions import Coalesce
from django.utils import timezone

from .core import Job

SALARY_BUCKETS = [
    ('u10', 'Dưới 10 triệu', None, 10_000_000),
    ('10-15', '10 - 15 triệu', 10_000_000, 15_000_000),
    ('15-20', '15 - 20 triệu', 15_000_000, 20_000_000),
    ('20-25', '20 - 25 triệu', 20_000_000, 25_000_000),
    ('25-30', '25 - 30 triệu', 25_000_000, 30_000_000),
    ('30-50', '30 - 50 triệu', 30_000_000, 50_000_000),
    ('o50', 'Trên 50 triệu', 50_000_000, None),
]


def job_public_time_filter(*, now=None, today=None, mode=None):
    """Return the active time-window predicate for the configured rollout mode."""
    now = now or timezone.now()
    today = today or timezone.localdate(now)
    mode = mode or getattr(settings, 'JOB_LIFECYCLE_V2_MODE', 'legacy')
    if str(mode).strip().lower() == 'enforce':
        return (Q(deadline__isnull=True) | Q(deadline__gte=today)) & Q(
            visibility_starts_at__lte=now, visibility_ends_at__gt=now
        )
    return Q(deadline__isnull=True) | Q(deadline__gte=today)


def publicly_available_job_filter():
    """One canonical availability predicate for every candidate-facing path."""
    return (
        Q(status=Job.Status.ACTIVE)
        & Q(policy_hold=Job.PolicyHold.NONE)
        & Q(moderation_hold=Job.ModerationHold.NONE)
        & ~Q(compliance_hold_links__hold__status='active')
        & Q(
            posted_by__status='active',
            posted_by__is_active=True,
            posted_by__is_deleted=False,
            posted_by__recruiter_profile__company_id=F('company_id'),
        )
        & (
            Q(posted_by__recruiter_profile__verification_case__isnull=True)
            | Q(posted_by__recruiter_profile__verification_case__company_id=F('company_id'))
        )
        & job_public_time_filter()
        & (
            Q(campaign__isnull=True)
            | Q(
                campaign__status='active',
                campaign__policy_hold='',
                campaign__owner__user__status='active',
                campaign__owner__user__is_active=True,
                campaign__owner__user__is_deleted=False,
            )
            & ~Q(campaign__compliance_hold_links__hold__status='active')
        )
    )


def filter_salary_bucket_queryset(queryset, bucket_key):
    """Preserve the public homepage bucket contract based on displayed upper salary."""
    bucket = next((item for item in SALARY_BUCKETS if item[0] == bucket_key), None)
    if not bucket:
        raise ValueError('Invalid salary bucket.')

    _, _, lower, upper = bucket
    queryset = (
        queryset.exclude(salary_type=Job.SalaryType.NEGOTIABLE)
        .exclude(salary_min__isnull=True, salary_max__isnull=True)
        .annotate(salary_bucket_value=Coalesce('salary_max', 'salary_min'))
    )
    if lower is not None:
        queryset = queryset.filter(salary_bucket_value__gt=lower)
    if upper is not None:
        queryset = queryset.filter(salary_bucket_value__lte=upper)
    return queryset


def filter_alert_salary_bucket_queryset(queryset, bucket_key):
    """Match a VND alert range by overlap, exactly like the public salary range URL."""
    bucket = next((item for item in SALARY_BUCKETS if item[0] == bucket_key), None)
    if not bucket:
        raise ValueError('Invalid salary bucket.')

    _, _, lower, upper = bucket
    queryset = queryset.filter(currency=Job.Currency.VND).exclude(
        salary_type=Job.SalaryType.NEGOTIABLE
    )
    if lower is not None:
        queryset = queryset.filter(
            Q(salary_max__gte=lower) | Q(salary_max__isnull=True, salary_min__gte=lower)
        )
    if upper is not None:
        queryset = queryset.filter(
            Q(salary_min__lte=upper) | Q(salary_min__isnull=True, salary_max__lte=upper)
        )
    queryset = queryset.exclude(salary_min__isnull=True, salary_max__isnull=True)
    return queryset


def active_jobs_queryset(include_preview=False):
    """Public jobs with relations needed by candidate-facing response and mail paths."""
    relations = [
        'category_assignments__category',
        'job_locations__location__parent',
        'job_skills__skill',
    ]
    if include_preview:
        relations.extend(['job_benefits__benefit', 'work_schedules'])
    queryset = (
        Job.objects.filter(publicly_available_job_filter())
        .select_related('company', 'campaign', 'posted_by', 'posted_by__recruiter_profile')
        .prefetch_related(*relations)
    )
    if not include_preview:
        queryset = queryset.defer(
            'description',
            'requirements',
            'benefits',
            'work_schedule_note',
            'rejected_reason',
        )
    return queryset
