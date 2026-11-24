"""Read queries owned by an employer for the jobs domain."""

from collections import defaultdict
from datetime import timedelta

from django.db.models import (
    CharField,
    Count,
    Exists,
    F,
    IntegerField,
    OuterRef,
    Prefetch,
    Q,
    Subquery,
    Value,
)
from django.db.models.functions import Coalesce, Least, TruncDate
from django.utils import timezone
from django.utils.translation import gettext as _

from apps.applications.models import Application
from common.vietnam_time import VIETNAM_TZ, vietnam_today

from ..models import Job, JobCategoryAssignment, JobModerationEvent, JobState
from ..models.querysets import job_effective_state_expression, with_job_visibility

# Days before ``closes_on`` that the list flags a live job as closing soon.
EXPIRING_SOON_DAYS = 7
# ``ordering`` values of the management list (``-`` prefix = descending).
EMPLOYER_JOB_ORDERINGS = {
    'created': 'created_at',
    'updated': 'updated_at',
    'deadline': 'closes_on',
    'candidates': 'candidate_count',
    'unviewed': 'unviewed_application_count',
    'views': 'view_count',
}
EMPLOYER_JOB_ATTENTION_FILTERS = ('unviewed', 'expiring')


def _latest_hide_reason_codes(job_reference):
    return (
        JobModerationEvent.objects.filter(
            job_id=job_reference,
            action__in=(
                JobModerationEvent.Action.HIDE,
                JobModerationEvent.Action.REQUEST_CHANGES,
            ),
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


def _requested_changes(job):
    """What the owner needs to fix a job held for changes (the note is written for them)."""
    if job.moderation_hold != Job.ModerationHold.CHANGES_REQUESTED:
        return {'editable': False, 'resubmitted_at': None, 'request_note': ''}
    latest = (
        JobModerationEvent.objects.filter(job=job, action=JobModerationEvent.Action.REQUEST_CHANGES)
        .order_by('-created_at', '-id')
        .values_list('note', flat=True)
        .first()
    )
    return {
        'editable': job.editable_for_requested_changes,
        'resubmitted_at': job.moderation_resubmitted_at,
        'request_note': latest or '',
    }


def employer_job_visibility_hold(job):
    """Explain to the owner why candidates cannot see a job; ``None`` when nothing holds it.

    Only the reason category is exposed: the note of a hide stays internal
    because it can quote the person who reported the job. A change request's
    note is written for the owner and is shown so they know what to fix.
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
            **_requested_changes(job),
        }
    if job.policy_hold:
        return {
            'kind': 'account',
            'editable': False,
            'resubmitted_at': None,
            'request_note': '',
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
        Application.objects.filter(job_id__in=job_ids, is_current=True)
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
                'full_name': row['candidate__full_name'] or _('Ứng viên'),
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


def _employer_jobs(user, *, campaign=None, q=None):
    queryset = Job.objects.filter(posted_by=user)
    if campaign:
        queryset = queryset.filter(campaign__public_id=campaign)
    if q:
        queryset = queryset.filter(title__icontains=q.strip())
    return queryset


def _closes_on():
    """Last day candidates can apply: the earlier of the deadline and the display window."""
    return Least('deadline', TruncDate('visibility_ends_at', tzinfo=VIETNAM_TZ))


def _unviewed_applications():
    return Application.objects.filter(
        job_id=OuterRef('pk'),
        status=Application.Status.SUBMITTED,
        is_current=True,
    )


def _expiring_soon(now):
    deadline = vietnam_today(now) + timedelta(days=EXPIRING_SOON_DAYS)
    return Q(effective_state=JobState.ACTIVE, closes_on__lte=deadline)


def _ordering(value):
    """``order_by`` arguments for a public ``ordering`` value; newest first otherwise."""
    descending = (value or '').startswith('-')
    field = EMPLOYER_JOB_ORDERINGS.get((value or '').lstrip('-'))
    if field is None:
        return ('-created_at', '-id')
    expression = F(field)
    expression = expression.desc(nulls_last=True) if descending else expression.asc(nulls_last=True)
    return (expression, '-id')


def employer_job_list_queryset(
    user, *, status=None, campaign=None, q=None, attention=None, ordering=None
):
    """Compact query for the employer management table."""
    candidate_count = (
        Application.objects.filter(job_id=OuterRef('pk'))
        .values('job_id')
        .annotate(total=Count('candidate_id', distinct=True))
        .values('total')[:1]
    )
    unviewed_count = (
        _unviewed_applications().values('job_id').annotate(total=Count('id')).values('total')[:1]
    )
    queryset = (
        with_job_visibility(_with_hold_reason(_employer_jobs(user, campaign=campaign, q=q)))
        .select_related('company', 'campaign')
        .prefetch_related(
            'job_locations__location__parent',
            # One query: the primary specialisation names its category column.
            Prefetch(
                'category_assignments',
                queryset=JobCategoryAssignment.objects.select_related('category'),
            ),
        )
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
            unviewed_application_count=Coalesce(
                Subquery(unviewed_count, output_field=IntegerField()),
                0,
            ),
            closes_on=_closes_on(),
        )
        .order_by(*_ordering(ordering))
    )
    if status:
        queryset = queryset.filter(effective_state=status)
    if attention == 'unviewed':
        queryset = queryset.filter(unviewed_application_count__gt=0)
    elif attention == 'expiring':
        queryset = queryset.filter(_expiring_soon(timezone.now()))
    return queryset


def employer_job_list_counts(user, *, status=None, campaign=None, q=None):
    """Status tab and attention-chip counts of the list in one aggregate query.

    Tabs count every state under the search; the attention chips count inside
    the open tab, so a chip never promises rows the tab cannot show.
    """
    now = timezone.now()
    queryset = _employer_jobs(user, campaign=campaign, q=q).alias(
        effective_state=job_effective_state_expression(at=now),
        closes_on=_closes_on(),
        has_unviewed=Exists(_unviewed_applications()),
    )
    in_tab = Q(effective_state=status) if status else Q()
    counts = queryset.aggregate(
        **{state: Count('id', filter=Q(effective_state=state)) for state in JobState.values},
        attention_unviewed=Count('id', filter=in_tab & Q(has_unviewed=True)),
        attention_expiring=Count('id', filter=in_tab & _expiring_soon(now)),
    )
    attention = {key: counts.pop(f'attention_{key}') for key in EMPLOYER_JOB_ATTENTION_FILTERS}
    return {'all': sum(counts.values()), **counts}, attention


def employer_job_status_counts(user, *, campaign=None, q=None):
    """Count every status tab of the list in one query, under the same search."""
    return employer_job_list_counts(user, campaign=campaign, q=q)[0]


def employer_job_application_summary(job):
    """Aggregate the latest submission of each candidate by recruiter status.

    The summary carries no candidate identity, so the job detail can show it
    even while candidate-data access is blocked.
    """
    by_status = dict.fromkeys(Application.Status.values, 0)
    rows = (
        Application.objects.filter(job=job, is_current=True)
        .values('status')
        .annotate(total=Count('id'))
        .order_by()
    )
    by_status.update({row['status']: row['total'] for row in rows})
    return {
        'total': sum(by_status.values()),
        'unviewed': by_status[Application.Status.SUBMITTED],
        'unanswered': sum(by_status[state] for state in Application.UNANSWERED_STATUSES),
        'by_status': by_status,
    }


def employer_job_detail_queryset(user):
    """Full form query for one employer-owned job."""
    return (
        with_job_visibility(_with_hold_reason(Job.objects.filter(posted_by=user)))
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
