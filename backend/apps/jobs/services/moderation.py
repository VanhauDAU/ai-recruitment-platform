"""Administrative moderation workflows for submitted job postings."""

import hashlib
from http import HTTPStatus

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import APIException, ValidationError

from apps.accounts.services import (
    InvalidImpactToken,
    StaleImpactToken,
    create_impact_token,
    decode_impact_token,
    is_account_accessible,
)
from apps.employers.models import RecruitmentCampaign
from apps.employers.services import recruiter_job_approval_state

from ..models import Job, JobModerationEvent, JobStatusHistory
from .content_snapshot import build_job_content_snapshot
from .lifecycle import initialize_job_visibility
from .posting import _record_status, job_deadline_error

REVIEW_OPERATION = 'job.moderation.mutate'

# A deadline that lapsed while the job waited in the queue does not hide the
# approve action: the reviewer sets a new deadline as part of the approval.
FIXABLE_BLOCK_CODES = {'deadline_expired'}


class JobModerationStale(APIException):
    status_code = HTTPStatus.CONFLICT
    default_detail = 'Tin đã thay đổi sau khi bạn mở bản xem trước. Vui lòng tải lại.'
    default_code = 'job_moderation_stale'


def job_moderation_revision(job):
    return int(job.updated_at.timestamp() * 1_000_000)


def job_content_fingerprint(job):
    value = f'{job.public_id}:{job_moderation_revision(job)}'
    return hashlib.sha256(value.encode()).hexdigest()


def create_job_review_token(job):
    return create_impact_token(
        revision=job_moderation_revision(job),
        operation=REVIEW_OPERATION,
        resource_key=f'job:{job.public_id}',
        normalized_payload={},
    )


def _verify_review_token(job, review_token):
    if not review_token:
        return
    try:
        claims = decode_impact_token(
            review_token,
            operation=REVIEW_OPERATION,
            resource_key=f'job:{job.public_id}',
            normalized_payload={},
        )
    except (InvalidImpactToken, StaleImpactToken) as error:
        raise JobModerationStale(str(error)) from error
    if claims['revision'] != job_moderation_revision(job):
        raise JobModerationStale()


def job_moderation_state(job, *, employer_approval_state=None):
    blocked = []
    if not is_account_accessible(job.posted_by):
        blocked.append(
            {'code': 'employer_restricted', 'label': 'Tài khoản nhà tuyển dụng đang bị hạn chế.'}
        )
    if job.policy_hold:
        blocked.append({'code': 'policy_hold', 'label': job.get_policy_hold_display()})
    if job.moderation_hold:
        blocked.append({'code': 'moderation_hold', 'label': job.get_moderation_hold_display()})
    if job.deadline and job.deadline < timezone.localdate():
        blocked.append({'code': 'deadline_expired', 'label': 'Hạn nhận hồ sơ đã qua.'})
    if job.campaign_id:
        if job.campaign.policy_hold:
            blocked.append(
                {'code': 'campaign_policy_hold', 'label': 'Chiến dịch đang bị policy hold.'}
            )
        if job.campaign.status != 'active':
            blocked.append(
                {'code': 'campaign_inactive', 'label': 'Chiến dịch hiện không hoạt động.'}
            )

    if employer_approval_state is None:
        employer_approval_state = recruiter_job_approval_state(
            job.posted_by,
            company_id=job.company_id,
        )
    blocked.extend(employer_approval_state['approve_blockers'])

    approve_blockers = [item for item in blocked if item['code'] not in FIXABLE_BLOCK_CODES]
    approve_requirements = [
        {
            'code': 'deadline',
            'label': 'Hạn nhận hồ sơ đã qua — chọn hạn mới để duyệt tin.',
        }
        for item in blocked
        if item['code'] == 'deadline_expired'
    ]

    actions = []
    if job.status == Job.Status.PENDING:
        actions.append('reject')
        if not approve_blockers:
            actions.insert(0, 'approve')
    if job.status == Job.Status.ACTIVE and not job.moderation_hold:
        actions.append('hide')
    if job.moderation_hold:
        actions.append('restore')
    return {
        'state_actions': actions,
        'blocked_reasons': blocked,
        'approve_blockers': approve_blockers,
        'approve_requirements': approve_requirements,
    }


def _record_moderation_event(
    *,
    job,
    action,
    actor,
    fingerprint,
    reason_code='',
    note='',
    from_status='',
    to_status='',
    from_hold='',
    to_hold='',
    source_report=None,
):
    return JobModerationEvent.objects.create(
        job=job,
        action=action,
        actor=actor,
        reason_code=reason_code,
        note=note,
        from_status=from_status,
        to_status=to_status,
        from_hold=from_hold,
        to_hold=to_hold,
        source_report=source_report,
        content_fingerprint=fingerprint,
    )


def _approval_deadline(deadline, *, required):
    """Validate the deadline a reviewer sets while approving, if any."""
    if deadline is None:
        if required:
            raise ValidationError({'deadline': 'Chọn hạn nhận hồ sơ mới để duyệt tin đã quá hạn.'})
        return None
    if deadline_error := job_deadline_error(deadline):
        raise ValidationError({'deadline': deadline_error})
    return deadline


@transaction.atomic
def approve_job(*, job, user, review_token='', deadline=None):
    """Make one pending job public after an administrator approves its revision."""
    stale_posted_by_id = job.posted_by_id
    stale_company_id = job.company_id
    stale_campaign_id = job.campaign_id
    employer_approval_state = recruiter_job_approval_state(
        job.posted_by,
        company_id=stale_company_id,
        lock=True,
    )
    locked_campaign = None
    if stale_campaign_id:
        try:
            locked_campaign = RecruitmentCampaign.objects.select_for_update(of=('self',)).get(
                pk=stale_campaign_id
            )
        except RecruitmentCampaign.DoesNotExist as error:
            raise JobModerationStale() from error
    job = (
        Job.objects.select_for_update(of=('self',))
        .select_related('posted_by', 'campaign')
        .get(pk=job.pk)
    )
    if (
        job.posted_by_id != stale_posted_by_id
        or job.company_id != stale_company_id
        or job.campaign_id != stale_campaign_id
    ):
        raise JobModerationStale()
    if locked_campaign is not None:
        job.campaign = locked_campaign
    _verify_review_token(job, review_token)
    if job.status != Job.Status.PENDING:
        raise ValidationError('Chỉ có thể duyệt tin đang chờ duyệt.')
    state = job_moderation_state(job, employer_approval_state=employer_approval_state)
    if state['approve_blockers']:
        raise ValidationError(
            {
                'code': 'JOB_APPROVAL_BLOCKED',
                'detail': 'Không thể duyệt tin.',
                'blocked_reasons': state['approve_blockers'],
            }
        )
    new_deadline = _approval_deadline(deadline, required=bool(state['approve_requirements']))

    fingerprint = job_content_fingerprint(job)
    now = timezone.now()
    note = ''
    update_fields = [
        'status',
        'approved_at',
        'published_at',
        'rejected_reason',
        'approved_snapshot',
        'approved_snapshot_at',
        'updated_at',
    ]
    update_fields.extend(initialize_job_visibility(job, approved_at=now))
    if new_deadline and new_deadline != job.deadline:
        note = f'Duyệt kèm gia hạn hạn nhận hồ sơ đến {new_deadline:%d/%m/%Y}.'
        job.deadline = new_deadline
        update_fields.append('deadline')
    job.status = Job.Status.ACTIVE
    job.approved_at = now
    job.published_at = now
    job.rejected_reason = ''
    job.approved_snapshot = build_job_content_snapshot(job)
    job.approved_snapshot_at = now
    job.save(update_fields=update_fields)
    _record_status(
        job,
        from_status=Job.Status.PENDING,
        to_status=Job.Status.ACTIVE,
        user=user,
        note=note,
        actor_role=JobStatusHistory.ActorRole.ADMIN,
    )
    _record_moderation_event(
        job=job,
        action=JobModerationEvent.Action.APPROVE,
        actor=user,
        fingerprint=fingerprint,
        note=note,
        from_status=Job.Status.PENDING,
        to_status=Job.Status.ACTIVE,
    )
    return job


@transaction.atomic
def reject_job(*, job, user, reason, reason_code='', review_token=''):
    """Reject one pending job with a mandatory, employer-visible explanation."""
    job = (
        Job.objects.select_for_update(of=('self',))
        .select_related('posted_by', 'campaign')
        .get(pk=job.pk)
    )
    _verify_review_token(job, review_token)
    if job.status != Job.Status.PENDING:
        raise ValidationError('Chỉ có thể từ chối tin đang chờ duyệt.')
    reason = reason.strip()
    if not reason:
        raise ValidationError(
            {'reason': 'Nhập lý do từ chối để nhà tuyển dụng có thể chỉnh sửa tin.'}
        )

    fingerprint = job_content_fingerprint(job)
    job.status = Job.Status.REJECTED
    job.approved_at = None
    job.published_at = None
    job.rejected_reason = reason
    job.save(
        update_fields=['status', 'approved_at', 'published_at', 'rejected_reason', 'updated_at']
    )
    _record_status(
        job,
        from_status=Job.Status.PENDING,
        to_status=Job.Status.REJECTED,
        user=user,
        note=reason,
        actor_role=JobStatusHistory.ActorRole.ADMIN,
    )
    _record_moderation_event(
        job=job,
        action=JobModerationEvent.Action.REJECT,
        actor=user,
        fingerprint=fingerprint,
        reason_code=reason_code,
        note=reason,
        from_status=Job.Status.PENDING,
        to_status=Job.Status.REJECTED,
    )
    return job


@transaction.atomic
def hide_job_visibility(
    *,
    job,
    user,
    reason_code,
    note,
    review_token,
    hold=Job.ModerationHold.MANUAL_REVIEW,
    source_report=None,
):
    job = (
        Job.objects.select_for_update(of=('self',))
        .select_related('posted_by', 'campaign')
        .get(pk=job.pk)
    )
    _verify_review_token(job, review_token)
    if job.status != Job.Status.ACTIVE:
        raise ValidationError('Chỉ có thể tạm ẩn tin đang tuyển.')
    if job.moderation_hold:
        raise ValidationError('Tin đã bị tạm ẩn.')
    if hold not in Job.ModerationHold.values or not hold:
        raise ValidationError({'hold': 'Loại tạm giữ không hợp lệ.'})
    if source_report is not None and source_report.job_id != job.id:
        raise ValidationError({'source_report': 'Báo cáo không thuộc tin này.'})
    note = note.strip()
    if not note:
        raise ValidationError({'note': 'Nhập căn cứ tạm ẩn tin.'})

    fingerprint = job_content_fingerprint(job)
    previous_hold = job.moderation_hold
    job.moderation_hold = hold
    job.moderation_held_at = timezone.now()
    job.save(update_fields=['moderation_hold', 'moderation_held_at', 'updated_at'])
    _record_moderation_event(
        job=job,
        action=JobModerationEvent.Action.HIDE,
        actor=user,
        fingerprint=fingerprint,
        reason_code=reason_code,
        note=note,
        from_hold=previous_hold,
        to_hold=hold,
        source_report=source_report,
    )
    return job


@transaction.atomic
def restore_job_visibility(*, job, user, note, review_token):
    job = (
        Job.objects.select_for_update(of=('self',))
        .select_related('posted_by', 'campaign')
        .get(pk=job.pk)
    )
    _verify_review_token(job, review_token)
    if not job.moderation_hold:
        raise ValidationError('Tin không bị moderation hold.')
    note = note.strip()
    if not note:
        raise ValidationError({'note': 'Nhập lý do khôi phục hiển thị.'})

    fingerprint = job_content_fingerprint(job)
    previous_hold = job.moderation_hold
    job.moderation_hold = Job.ModerationHold.NONE
    job.moderation_held_at = None
    job.save(update_fields=['moderation_hold', 'moderation_held_at', 'updated_at'])
    _record_moderation_event(
        job=job,
        action=JobModerationEvent.Action.RESTORE,
        actor=user,
        fingerprint=fingerprint,
        note=note,
        from_hold=previous_hold,
        to_hold=Job.ModerationHold.NONE,
    )
    return job
