"""Status transitions that make a job public, keep it public or take it down."""

from datetime import timedelta

from django.db import transaction
from django.utils import timezone
from django.utils.text import slugify
from django.utils.translation import gettext
from rest_framework.exceptions import ValidationError

from apps.campaigns.models import CampaignActivity
from apps.employers.services import recruiter_job_publication_state
from common.vietnam_time import vietnam_today

from ...models import Job, JobStatusHistory
from ..content_snapshot import build_job_content_snapshot
from ..lifecycle import extend_job_visibility, initialize_job_visibility
from ..policy import job_renewal_grace_days
from .history import _record_status
from .locking import (
    _locked_job,
    _locked_recruiter,
    _validate_campaign_for_write,
    _validate_job_for_write,
)
from .quota import _posting_quota, _quota_exhausted_message
from .rules import (
    RESPONSIBILITY_STATEMENT_VERSION,
    _ensure_public_lifetime,
    _ensure_publication_allowed,
    _ensure_responsibility_accepted,
    _ensure_visibility_window_open,
    _validate_publishable,
    job_deadline_error,
)


def _go_live(job, *, user, previous_status, acknowledged, update_fields=()):
    """Make one job public and start, or resume, its visibility cycle.

    The content snapshot taken here is the baseline administrators compare
    later edits against when they review a report.
    """
    now = timezone.now()
    if acknowledged:
        job.responsibility_accepted_at = now
        job.responsibility_statement_version = RESPONSIBILITY_STATEMENT_VERSION
    lifecycle_fields = initialize_job_visibility(job, approved_at=now)
    job.status = Job.Status.ACTIVE
    job.submitted_at = job.submitted_at or now
    job.published_at = now
    job.approved_at = now
    job.closed_at = None
    job.slug = f'{slugify(job.title)}-{job.public_id}'
    job.approved_snapshot = build_job_content_snapshot(job)
    job.approved_snapshot_at = now
    job.save(
        update_fields=[
            *update_fields,
            *lifecycle_fields,
            'status',
            'submitted_at',
            'published_at',
            'approved_at',
            'closed_at',
            'slug',
            'approved_snapshot',
            'approved_snapshot_at',
            'responsibility_accepted_at',
            'responsibility_statement_version',
            'updated_at',
        ]
    )
    _record_status(job, from_status=previous_status, to_status=Job.Status.ACTIVE, user=user)
    return job


@transaction.atomic
def publish_job(job, user, *, accepted_statement_version=''):
    """Publish a recruiter-owned draft; candidates can see it as soon as this returns."""
    recruiter = _locked_recruiter(user)
    publication_state = recruiter_job_publication_state(
        user,
        company_id=job.company_id,
        lock=True,
    )
    job, _ = _locked_job(job)
    if job.posted_by_id != user.id:
        raise ValidationError(gettext('Bạn không có quyền đăng tin này.'))
    if job.status == Job.Status.CLOSED:
        raise ValidationError(gettext('Mở lại tin đã đóng thay vì đăng lại.'))
    if job.status == Job.Status.ACTIVE:
        return job
    _ensure_responsibility_accepted(accepted_statement_version)
    _ensure_publication_allowed(job, publication_state)
    _validate_job_for_write(job)
    _validate_campaign_for_write(job.campaign, recruiter=recruiter)
    _validate_publishable(job)
    _ensure_visibility_window_open(job)
    if job.submitted_at is None:
        _, entitlement, limit = _posting_quota(user)
        used = Job.objects.filter(posted_by=user, submitted_at__isnull=False).count()
        if used >= limit:
            raise ValidationError(
                {
                    'detail': _quota_exhausted_message(
                        verified_level_three=entitlement['verified_job_quota_eligible'],
                        limit=limit,
                    ),
                }
            )
    return _go_live(
        job,
        user=user,
        previous_status=job.status,
        acknowledged=True,
    )


@transaction.atomic
def publish_operator_imported_job(job, *, user):
    """Make an operator-imported draft public without the recruiter gates.

    Bulk loads of demo and evaluation postings are run by an operator, not by
    the recruiter, so quota and the publication commitment do not apply. The
    caller only picks publishers allowed to open candidate data, since the
    public predicate hides any other job.
    """
    _validate_publishable(job)
    return _go_live(job, user=user, previous_status=job.status, acknowledged=False)


@transaction.atomic
def reopen_job(job, user, deadline, *, accepted_statement_version=''):
    recruiter = _locked_recruiter(user)
    publication_state = recruiter_job_publication_state(
        user,
        company_id=job.company_id,
        lock=True,
    )
    job, _ = _locked_job(job)
    if job.posted_by_id != user.id or job.status != Job.Status.CLOSED:
        raise ValidationError(gettext('Chỉ có thể mở lại tin đã đóng của bạn.'))
    _ensure_responsibility_accepted(accepted_statement_version)
    _ensure_publication_allowed(job, publication_state)
    _validate_job_for_write(job)
    _validate_campaign_for_write(job.campaign, recruiter=recruiter)
    if deadline_error := job_deadline_error(deadline):
        raise ValidationError({'deadline': deadline_error})
    _ensure_visibility_window_open(job)
    # Reopening keeps the original cycle and credit, so it obeys the renewal
    # rules instead of becoming a way around them.
    _ensure_public_lifetime(job, deadline)
    job.deadline = deadline
    return _go_live(
        job,
        user=user,
        previous_status=Job.Status.CLOSED,
        acknowledged=True,
        update_fields=('deadline',),
    )


@transaction.atomic
def extend_job_deadline(job, user, deadline, *, requested_visibility_days=None):
    recruiter = _locked_recruiter(user)
    publication_state = recruiter_job_publication_state(
        user,
        company_id=job.company_id,
        lock=True,
    )
    job, _ = _locked_job(job)
    if job.posted_by_id != user.id or job.status != Job.Status.ACTIVE:
        raise ValidationError(gettext('Chỉ có thể gia hạn tin đang tuyển của bạn.'))
    _ensure_publication_allowed(job, publication_state)
    _validate_job_for_write(job)
    _validate_campaign_for_write(job.campaign, recruiter=recruiter)
    today = vietnam_today()
    deadline = deadline or job.deadline
    deadline_extended = bool(
        deadline is not None and (job.deadline is None or deadline > job.deadline)
    )
    if not deadline_extended and requested_visibility_days is None:
        raise ValidationError({'deadline': gettext('Hạn gia hạn phải sau hạn nộp hiện tại.')})
    if job.deadline is not None and deadline is not None and deadline < job.deadline:
        raise ValidationError(
            {'deadline': gettext('Không thể rút ngắn hạn nhận hồ sơ khi gia hạn.')}
        )
    if deadline_error := job_deadline_error(deadline, today=today):
        raise ValidationError({'deadline': deadline_error})
    if job.deadline is not None and job.deadline < today - timedelta(days=job_renewal_grace_days()):
        raise ValidationError(
            {
                'deadline': gettext('Chỉ có thể gia hạn tin hết hạn trong vòng %(days)s ngày.')
                % {'days': job_renewal_grace_days()}
            }
        )
    visibility_end = job.visibility_ends_at
    if requested_visibility_days is not None and job.visibility_starts_at is not None:
        visibility_end = job.visibility_starts_at + timedelta(days=requested_visibility_days)
    _ensure_public_lifetime(job, deadline, visibility_end=visibility_end)

    lifecycle_update_fields = []
    if requested_visibility_days is not None:
        lifecycle_update_fields = extend_job_visibility(
            job,
            requested_visibility_days=requested_visibility_days,
        )

    job.deadline = deadline
    job.save(update_fields=['deadline', *lifecycle_update_fields, 'updated_at'])
    if job.campaign_id:
        CampaignActivity.objects.record(
            campaign=job.campaign,
            event_type=CampaignActivity.EventType.JOB_UPDATED,
            group=CampaignActivity.Group.JOB,
            actor=user,
            subject_public_id=job.public_id,
            metadata={'title': job.title, 'deadline': deadline.isoformat()},
        )
    return job


@transaction.atomic
def close_job(job, user):
    _locked_recruiter(user)
    job, _ = _locked_job(job)
    if job.posted_by_id != user.id or job.status != Job.Status.ACTIVE:
        raise ValidationError(gettext('Chỉ có thể đóng tin đang tuyển của bạn.'))
    job.status = Job.Status.CLOSED
    job.closed_at = timezone.now()
    job.save(update_fields=['status', 'closed_at', 'updated_at'])
    _record_status(job, from_status=Job.Status.ACTIVE, to_status=Job.Status.CLOSED, user=user)
    return job


@transaction.atomic
def close_campaign_jobs(campaign, *, user=None):
    """Stop every public job of a campaign that has just ended.

    Ending a campaign is a recruiting decision, so its jobs become ``closed``
    with history rather than lingering ``active`` behind a hidden campaign.
    The caller already holds the campaign row lock; jobs are locked after it.
    """
    now = timezone.now()
    jobs = list(
        Job.objects.select_for_update(of=('self',))
        .select_related('campaign')
        .filter(campaign=campaign, status=Job.Status.ACTIVE)
        .order_by('pk')
    )
    actor_role = JobStatusHistory.ActorRole.EMPLOYER if user else JobStatusHistory.ActorRole.SYSTEM
    for job in jobs:
        job.status = Job.Status.CLOSED
        job.closed_at = now
        job.save(update_fields=['status', 'closed_at', 'updated_at'])
        _record_status(
            job,
            from_status=Job.Status.ACTIVE,
            to_status=Job.Status.CLOSED,
            user=user,
            note='campaign_ended',
            actor_role=actor_role,
        )
    return len(jobs)
