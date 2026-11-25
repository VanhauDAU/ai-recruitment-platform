"""Recruiter edits to job content and campaign membership, outside publication."""

from copy import copy

from django.db import transaction
from django.utils import timezone
from django.utils.translation import gettext
from rest_framework.exceptions import ValidationError

from ...models import Job, JobApplicationContact, JobApplicationEmail
from ..ai_generation import apply_job_ai_generation_to_draft
from ..job_records import JOB_RELATIONS, create_job_record, update_job_record
from .history import _record_job_assignment, _record_status
from .locking import (
    _lock_campaigns,
    _locked_job,
    _locked_recruiter,
    _locked_requested_campaign,
    _validate_campaign_for_write,
    _validate_job_for_write,
)


@transaction.atomic
def save_job_draft(user, data):
    """Create a job from the (possibly partial) form as a draft.

    Drafts never consume a publication credit. ``data`` is the validated job
    form; its ``ai_generation_public_id`` links the AI result the form started from.
    """
    recruiter = _locked_recruiter(user)
    data = dict(data)
    generation_public_id = data.pop('ai_generation_public_id', '')
    requested_campaign = data.get('campaign')
    locked_campaigns = _lock_campaigns(
        requested_campaign.pk if requested_campaign is not None else None
    )
    locked_campaign = _locked_requested_campaign(requested_campaign, locked_campaigns)
    _validate_campaign_for_write(locked_campaign, recruiter=recruiter)
    if requested_campaign is not None:
        data['campaign'] = locked_campaign
    job = create_job_record(
        {**data, 'posted_by': user, 'company': recruiter.company, 'status': Job.Status.DRAFT}
    )
    if generation_public_id:
        apply_job_ai_generation_to_draft(
            public_id=generation_public_id,
            job=job,
            user=user,
        )
    _record_job_assignment(job, previous_campaign=None, user=user)
    _record_status(job, from_status='', to_status=Job.Status.DRAFT, user=user)
    return job


@transaction.atomic
def update_employer_job(job, user, data):
    """Persist validated form ``data`` on an employer's existing job (draft or not)."""
    recruiter = _locked_recruiter(user)
    data = dict(data)
    # Only a new job links an AI result; the form validation refuses it on edit.
    data.pop('ai_generation_public_id', None)
    requested_campaign = data.get('campaign', job.campaign)
    job, locked_campaigns = _locked_job(
        job,
        extra_campaign_ids=(requested_campaign.pk if requested_campaign is not None else None,),
    )
    if job.posted_by_id != user.id:
        raise ValidationError(gettext('Bạn không có quyền chỉnh sửa tin này.'))
    _validate_job_for_write(job, allow_requested_changes=True)
    previous_campaign = locked_campaigns.get(job.campaign_id)
    locked_requested_campaign = _locked_requested_campaign(requested_campaign, locked_campaigns)
    _validate_campaign_for_write(locked_requested_campaign, recruiter=recruiter)
    if 'campaign' in data:
        data['campaign'] = locked_requested_campaign
    requested_visibility_days = data.get('requested_visibility_days')
    if (
        job.first_approved_at is not None
        and requested_visibility_days is not None
        and requested_visibility_days != job.requested_visibility_days
    ):
        raise ValidationError(
            {
                'requested_visibility_days': (
                    gettext('Dùng thao tác gia hạn để thay đổi thời gian hiển thị của tin đã đăng.')
                )
            }
        )
    job = update_job_record(job, data)
    _record_job_assignment(job, previous_campaign=previous_campaign, user=user)
    return job


@transaction.atomic
def assign_job_to_campaign(job, user, campaign):
    """Move one of the recruiter's jobs into ``campaign`` (used when a campaign launches)."""
    recruiter = _locked_recruiter(user)
    job, locked_campaigns = _locked_job(job, extra_campaign_ids=(campaign.pk,))
    if job.posted_by_id != user.id:
        raise ValidationError(gettext('Bạn không có quyền dùng tin này.'))
    if job.campaign_id == campaign.pk:
        return job
    previous_campaign = locked_campaigns.get(job.campaign_id)
    if previous_campaign is not None and not previous_campaign.is_terminal:
        raise ValidationError({'job': gettext('Tin đang thuộc một chiến dịch khác còn chạy.')})
    locked_campaign = _locked_requested_campaign(campaign, locked_campaigns)
    _validate_campaign_for_write(locked_campaign, recruiter=recruiter)
    if locked_campaign.target_date and job.deadline and job.deadline > locked_campaign.target_date:
        raise ValidationError(
            {'deadline': gettext('Hạn nhận hồ sơ của tin sau ngày kết thúc chiến dịch.')}
        )
    job.campaign = locked_campaign
    job.save(update_fields=['campaign', 'updated_at'])
    _record_job_assignment(job, previous_campaign=previous_campaign, user=user)
    return job


@transaction.atomic
def duplicate_job(job, user):
    _locked_recruiter(user)
    job, _ = _locked_job(job)
    if job.posted_by_id != user.id:
        raise ValidationError(gettext('Bạn không có quyền sao chép tin này.'))
    if job.policy_hold or job.moderation_hold or (job.campaign_id and job.campaign.policy_hold):
        raise ValidationError(
            {
                'code': 'RECRUITMENT_HOLD_ACTIVE',
                'detail': gettext('Không thể sao chép khi tin hoặc chiến dịch đang bị tạm giữ.'),
            }
        )
    duplicate = copy(job)
    duplicate.pk = None
    duplicate.id = None
    duplicate.public_id = ''
    duplicate.code = ''
    duplicate.slug = ''
    duplicate.status = Job.Status.DRAFT
    duplicate.submitted_at = None
    duplicate.published_at = None
    duplicate.closed_at = None
    duplicate.approved_at = None
    duplicate.first_approved_at = None
    duplicate.visibility_starts_at = None
    duplicate.visibility_ends_at = None
    duplicate.approved_snapshot = {}
    duplicate.approved_snapshot_at = None
    duplicate.responsibility_accepted_at = None
    duplicate.responsibility_statement_version = ''
    duplicate.policy_hold = Job.PolicyHold.NONE
    duplicate.policy_held_at = None
    duplicate.policy_hold_transition = None
    duplicate.moderation_hold = Job.ModerationHold.NONE
    duplicate.moderation_held_at = None
    duplicate.view_count = 0
    duplicate.impression_count = 0
    duplicate.application_count = 0
    duplicate.engagement_tracking_started_at = timezone.now()
    duplicate.title = gettext('%(title)s (bản sao)') % {'title': job.title}
    duplicate.save()
    _record_job_assignment(duplicate, previous_campaign=None, user=user)
    for relation, model in JOB_RELATIONS.items():
        model.objects.bulk_create(
            [
                model(
                    **{
                        field.attname: getattr(item, field.attname)
                        for field in model._meta.fields
                        if field.name not in {'id', 'job'}
                    },
                    job=duplicate,
                )
                for item in getattr(job, relation).all()
            ]
        )
    contact = getattr(job, 'application_contact', None)
    if contact:
        duplicate_contact = JobApplicationContact.objects.create(
            job=duplicate,
            recipient_name=contact.recipient_name,
            phone=contact.phone,
        )
        JobApplicationEmail.objects.bulk_create(
            [
                JobApplicationEmail(
                    contact=duplicate_contact,
                    email=item.email,
                    sort_order=item.sort_order,
                )
                for item in contact.emails.all()
            ]
        )
    _record_status(
        duplicate, from_status='', to_status=Job.Status.DRAFT, user=user, note='Sao chép tin'
    )
    return duplicate


@transaction.atomic
def delete_job_draft(job, user):
    """Delete one recruiter-owned draft through the workspace write boundary."""
    _locked_recruiter(user)
    job, _ = _locked_job(job)
    if job.posted_by_id != user.id or job.status != Job.Status.DRAFT:
        raise ValidationError({'detail': gettext('Chỉ có thể xóa tin nháp của bạn.')})
    if job.submitted_at is not None:
        # A draft that was public before may already own applications.
        raise ValidationError({'detail': gettext('Không thể xóa tin đã từng được đăng.')})
    job.delete()
