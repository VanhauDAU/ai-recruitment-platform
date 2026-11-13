"""Administrative post-moderation of public job postings."""

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
from apps.employers.services import recruiter_job_publication_state

from ..models import Job, JobModerationEvent
from .lifecycle import lifecycle_local_date, lifecycle_mode

REVIEW_OPERATION = 'job.moderation.mutate'


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


def job_moderation_state(job):
    """Explain why a job is hidden from candidates and what an administrator may do."""
    blocked = []
    if not is_account_accessible(job.posted_by):
        blocked.append(
            {'code': 'employer_restricted', 'label': 'Tài khoản nhà tuyển dụng đang bị hạn chế.'}
        )
    if job.policy_hold:
        blocked.append({'code': 'policy_hold', 'label': job.get_policy_hold_display()})
    if job.moderation_hold:
        blocked.append({'code': 'moderation_hold', 'label': job.get_moderation_hold_display()})
    if job.deadline and job.deadline < lifecycle_local_date():
        blocked.append({'code': 'deadline_expired', 'label': 'Hạn nhận hồ sơ đã qua.'})
    if (
        lifecycle_mode() == 'enforce'
        and job.visibility_ends_at is not None
        and job.visibility_ends_at <= timezone.now()
    ):
        blocked.append(
            {
                'code': 'visibility_expired',
                'label': 'Tin đã hết vòng đời hiển thị và cần một lượt đăng mới.',
            }
        )
    if job.campaign_id:
        if job.campaign.policy_hold:
            blocked.append(
                {'code': 'campaign_policy_hold', 'label': 'Chiến dịch đang bị policy hold.'}
            )
        if job.campaign.status != 'active':
            blocked.append(
                {'code': 'campaign_inactive', 'label': 'Chiến dịch hiện không hoạt động.'}
            )

    blocked.extend(
        recruiter_job_publication_state(job.posted_by, company_id=job.company_id)[
            'publish_blockers'
        ]
    )

    actions = []
    if job.status == Job.Status.ACTIVE and not job.moderation_hold:
        actions.append('hide')
    if job.moderation_hold:
        actions.append('restore')
    return {'state_actions': actions, 'blocked_reasons': blocked}


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
def apply_confirmed_report_hold(*, job, actor, report, note):
    """Apply the durable visibility hold caused by an upheld trust report.

    This intentionally has no inverse in the report reversal flow: reversing a
    moderation conclusion restores badge eligibility, while republishing a job
    remains an explicit, separately audited administrator decision.
    """
    job = (
        Job.objects.select_for_update(of=('self',))
        .select_related('posted_by', 'campaign')
        .get(pk=job.pk)
    )
    if report.job_id != job.pk:
        raise ValidationError({'report': 'Báo cáo không thuộc tin này.'})
    if job.status != Job.Status.ACTIVE:
        return job
    if job.moderation_hold == Job.ModerationHold.CONFIRMED_VIOLATION:
        return job

    fingerprint = job_content_fingerprint(job)
    previous_hold = job.moderation_hold
    job.moderation_hold = Job.ModerationHold.CONFIRMED_VIOLATION
    job.moderation_held_at = timezone.now()
    job.save(update_fields=['moderation_hold', 'moderation_held_at', 'updated_at'])
    _record_moderation_event(
        job=job,
        action=JobModerationEvent.Action.HIDE,
        actor=actor,
        fingerprint=fingerprint,
        reason_code=JobModerationEvent.Reason.CONFIRMED_REPORT,
        note=note,
        from_hold=previous_hold,
        to_hold=Job.ModerationHold.CONFIRMED_VIOLATION,
        source_report=report,
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
