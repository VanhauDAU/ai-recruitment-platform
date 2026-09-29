"""Read models for administrator job management and moderation."""

from datetime import timedelta

from django.conf import settings
from django.db.models import BooleanField, Case, CharField, Count, Prefetch, Q, Value, When
from django.db.models.functions import Coalesce, NullIf
from django.utils import timezone

from common.db.search import search_q

from ..models import Job, JobModerationEvent, JobReport, JobStatusHistory
from .listing import publicly_available_job_filter


def _admin_job_queryset():
    return Job.objects.select_related(
        'company',
        'campaign',
        'posted_by',
        'posted_by__recruiter_profile',
    ).annotate(
        pending_report_count=Count(
            'reports',
            filter=Q(reports__status=JobReport.Status.PENDING),
            distinct=True,
        ),
        report_count=Count('reports', distinct=True),
        approved_job_count=Count(
            'posted_by__posted_jobs',
            filter=Q(posted_by__posted_jobs__approved_at__isnull=False),
            distinct=True,
        ),
        is_expired_value=Case(
            When(
                status=Job.Status.ACTIVE,
                deadline__lt=timezone.localdate(),
                then=Value(True),
            ),
            default=Value(False),
            output_field=BooleanField(),
        ),
        # Reuse the candidate-facing predicate so the admin link never points at
        # a page that would 404 for the public.
        is_publicly_visible=Case(
            When(publicly_available_job_filter(), then=Value(True)),
            default=Value(False),
            output_field=BooleanField(),
        ),
        employer_name_sort=Coalesce(
            NullIf('posted_by__full_name', Value('')),
            'posted_by__email',
            Value(''),
            output_field=CharField(),
        ),
    )


def admin_job_management_queryset(*, params=None):
    """Return all jobs visible to operations, including blocked or held rows."""
    params = params or {}
    queryset = _admin_job_queryset()

    if query := (params.get('q') or '').strip():
        queryset = queryset.filter(
            search_q('title', query)
            | search_q('company__company_name', query)
            | search_q('posted_by__full_name', query)
            | Q(public_id__icontains=query)
            | Q(posted_by__email__icontains=query)
        )

    scope = params.get('scope') or ''
    status_values = [value for value in (params.get('status') or '').split(',') if value]
    if scope == 'expired':
        queryset = queryset.filter(
            status=Job.Status.ACTIVE,
            deadline__lt=timezone.localdate(),
        )
    elif scope == 'held':
        queryset = queryset.filter(
            ~Q(policy_hold=Job.PolicyHold.NONE) | ~Q(moderation_hold=Job.ModerationHold.NONE)
        )
    elif status_values:
        queryset = queryset.filter(status__in=status_values)

    if company := params.get('company'):
        queryset = queryset.filter(company__public_id=company)
    if employer := params.get('employer'):
        queryset = queryset.filter(posted_by__public_id=employer)
    if tier := params.get('tier'):
        queryset = queryset.filter(tier=tier)
    if policy_hold := params.get('policy_hold'):
        queryset = queryset.filter(policy_hold=policy_hold)
    if moderation_hold := params.get('moderation_hold'):
        queryset = queryset.filter(moderation_hold=moderation_hold)
    if params.get('has_reports') in {'1', 'true'}:
        queryset = queryset.filter(pending_report_count__gt=0)
    if submitted_from := params.get('submitted_from'):
        queryset = queryset.filter(submitted_at__date__gte=submitted_from)
    if submitted_to := params.get('submitted_to'):
        queryset = queryset.filter(submitted_at__date__lte=submitted_to)
    if deadline_from := params.get('deadline_from'):
        queryset = queryset.filter(deadline__gte=deadline_from)
    if deadline_to := params.get('deadline_to'):
        queryset = queryset.filter(deadline__lte=deadline_to)

    ordering = params.get('ordering') or '-created_at'
    descending = ordering.startswith('-')
    ordering_key = ordering.removeprefix('-')
    ordering_fields = {
        'title': 'title',
        'company': 'company__company_name',
        'employer': 'employer_name_sort',
        'status': 'status',
        'deadline': 'deadline',
        'created_at': 'created_at',
        'submitted_at': 'submitted_at',
        'published_at': 'published_at',
        'updated_at': 'updated_at',
        'application_count': 'application_count',
        'view_count': 'view_count',
        'pending_reports': 'pending_report_count',
    }
    field = ordering_fields.get(ordering_key)
    if not field:
        return queryset.order_by('-created_at', '-id')
    prefix = '-' if descending else ''
    return queryset.order_by(f'{prefix}{field}', f'{prefix}id')


def job_moderation_queryset(*, status=None):
    """Compatibility selector for the original moderation endpoint."""
    params = {'status': status} if status else {}
    return admin_job_management_queryset(params=params)


def admin_job_detail_queryset():
    status_history = JobStatusHistory.objects.select_related('changed_by').order_by(
        '-created_at', '-id'
    )
    moderation_events = JobModerationEvent.objects.select_related(
        'actor', 'source_report'
    ).order_by('-created_at', '-id')
    reports = JobReport.objects.select_related('reporter', 'resolved_by').prefetch_related(
        'resolution_history__actor'
    )
    return _admin_job_queryset().prefetch_related(
        'category_assignments__category',
        'job_locations__location__parent',
        'job_skills__skill',
        'work_schedules',
        'job_benefits__benefit',
        'language_requirements__language',
        'application_contact__emails',
        Prefetch('status_history', queryset=status_history),
        Prefetch('moderation_events', queryset=moderation_events),
        Prefetch('reports', queryset=reports),
    )


def admin_job_management_summary():
    now = timezone.now()
    sla_hours = getattr(settings, 'JOB_MODERATION_SLA_HOURS', 24)
    jobs = Job.objects.aggregate(
        total=Count('id'),
        pending=Count('id', filter=Q(status=Job.Status.PENDING)),
        overdue=Count(
            'id',
            filter=Q(
                status=Job.Status.PENDING,
                submitted_at__lt=now - timedelta(hours=sla_hours),
            ),
        ),
        active=Count('id', filter=Q(status=Job.Status.ACTIVE)),
        expired=Count(
            'id',
            filter=Q(status=Job.Status.ACTIVE, deadline__lt=timezone.localdate()),
        ),
        rejected=Count('id', filter=Q(status=Job.Status.REJECTED)),
        closed=Count('id', filter=Q(status=Job.Status.CLOSED)),
        held=Count(
            'id',
            filter=(
                ~Q(policy_hold=Job.PolicyHold.NONE) | ~Q(moderation_hold=Job.ModerationHold.NONE)
            ),
        ),
    )
    jobs['pending_reports'] = JobReport.objects.filter(status=JobReport.Status.PENDING).count()
    jobs['sla_hours'] = sla_hours
    return jobs
