"""Read queries owned by an employer for the jobs domain."""

from collections import defaultdict
from zoneinfo import ZoneInfo

from django.conf import settings
from django.db.models import (
    BooleanField,
    Case,
    CharField,
    Count,
    IntegerField,
    OuterRef,
    Q,
    Subquery,
    Value,
    When,
)
from django.db.models.functions import Coalesce
from django.utils import timezone

from apps.applications.models import Application

from ..models import Job, JobModerationEvent


def _latest_hide_reason_codes(job_reference):
    return (
        JobModerationEvent.objects.filter(
            job_id=job_reference,
            action=JobModerationEvent.Action.HIDE,
        )
        .order_by('-created_at', '-id')
        .values('reason_code')
    )


def _with_hold_reason(queryset):
    """Annotate the reason of the latest hide so list pages need no extra query."""
    return queryset.annotate(
        moderation_hold_reason_code=Coalesce(
            Subquery(_latest_hide_reason_codes(OuterRef('pk'))[:1], output_field=CharField()),
            Value(''),
        )
    )


def employer_job_visibility_hold(job):
    """Explain to the owner why candidates cannot see a job; ``None`` when nothing holds it.

    Only the reason category is exposed. The administrator's note stays
    internal because it can quote the person who reported the job.
    """
    if job.moderation_hold:
        reason_code = getattr(job, 'moderation_hold_reason_code', None)
        if reason_code is None:
            latest_hide = _latest_hide_reason_codes(job.pk).first()
            reason_code = latest_hide['reason_code'] if latest_hide else ''
        return {
            'kind': 'moderation',
            'code': job.moderation_hold,
            'label': job.get_moderation_hold_display(),
            'held_at': job.moderation_held_at,
            'reason_code': reason_code,
            'reason_label': dict(JobModerationEvent.Reason.choices).get(reason_code, ''),
        }
    if job.policy_hold:
        return {
            'kind': 'account',
            'code': job.policy_hold,
            'label': job.get_policy_hold_display(),
            'held_at': job.policy_held_at,
            'reason_code': '',
            'reason_label': '',
        }
    return None


def attach_job_candidate_previews(jobs, *, limit=4):
    """Attach recent unique candidate previews with one flat query per page."""
    job_ids = [job.pk for job in jobs]
    previews_by_job = defaultdict(list)
    seen_candidates = defaultdict(set)
    for job in jobs:
        job.candidate_previews = []
    if not job_ids:
        return jobs

    remaining_jobs = set(job_ids)
    rows = (
        Application.objects.filter(job_id__in=job_ids)
        .order_by('job_id', '-applied_at', '-id')
        .values(
            'job_id',
            'public_id',
            'candidate_id',
            'candidate__public_id',
            'candidate__full_name',
            'candidate__avatar_url',
            'submitted_cv_title',
            'status',
            'applied_at',
        )
    )
    for row in rows:
        job_id = row['job_id']
        candidate_id = row['candidate_id']
        if job_id not in remaining_jobs or candidate_id in seen_candidates[job_id]:
            continue
        seen_candidates[job_id].add(candidate_id)
        previews_by_job[job_id].append(
            {
                'application_public_id': row['public_id'],
                'public_id': row['candidate__public_id'],
                'full_name': row['candidate__full_name'] or 'Ứng viên',
                'avatar_url': row['candidate__avatar_url'],
                'cv_title': row['submitted_cv_title'],
                'status': row['status'],
                'applied_at': row['applied_at'],
            }
        )
        if len(previews_by_job[job_id]) >= limit:
            remaining_jobs.discard(job_id)
            if not remaining_jobs:
                break

    for job in jobs:
        job.candidate_previews = previews_by_job[job.pk]
    return jobs


def employer_job_list_queryset(user, *, status=None, campaign=None, q=None):
    """Compact query for the employer management table."""
    now = timezone.now()
    today = timezone.localdate(now, timezone=ZoneInfo('Asia/Ho_Chi_Minh'))
    expired_filter = Q(deadline__lt=today)
    if str(getattr(settings, 'JOB_LIFECYCLE_V2_MODE', 'legacy')).lower() == 'enforce':
        expired_filter |= Q(visibility_ends_at__isnull=True) | Q(visibility_ends_at__lte=now)
    candidate_count = (
        Application.objects.filter(job_id=OuterRef('pk'))
        .values('job_id')
        .annotate(total=Count('candidate_id', distinct=True))
        .values('total')[:1]
    )
    queryset = (
        _with_hold_reason(Job.objects.filter(posted_by=user))
        .select_related('company', 'campaign')
        .prefetch_related('job_locations__location__parent')
        .defer(
            'description',
            'requirements',
            'benefits',
            'work_schedule_note',
        )
        .annotate(
            candidate_count=Coalesce(
                Subquery(candidate_count, output_field=IntegerField()),
                0,
            ),
            is_expired_value=Case(
                When(Q(status=Job.Status.ACTIVE) & expired_filter, then=Value(True)),
                default=Value(False),
                output_field=BooleanField(),
            ),
        )
        .order_by('-created_at', '-id')
    )
    if status == 'expired':
        queryset = queryset.filter(Q(status=Job.Status.ACTIVE) & expired_filter)
    elif status:
        queryset = queryset.filter(status=status)
        if status == Job.Status.ACTIVE:
            queryset = queryset.exclude(expired_filter)
    if campaign:
        queryset = queryset.filter(campaign__public_id=campaign)
    if q:
        queryset = queryset.filter(title__icontains=q.strip())
    return queryset


def employer_job_detail_queryset(user):
    """Full form query for one employer-owned job."""
    return (
        _with_hold_reason(Job.objects.filter(posted_by=user))
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
        .order_by('-created_at', '-id')
    )
