"""Write workflows for the applications domain."""

from datetime import timedelta
from http import HTTPStatus

from django.db import transaction
from django.db.models import F
from django.utils import timezone
from rest_framework.exceptions import APIException

from apps.accounts.services import is_account_accessible, lock_account_for_write
from apps.cvs.services import create_application_snapshot
from apps.employers.models import CampaignActivity, RecruitmentCampaign
from apps.employers.services import (
    ensure_recruiter_candidate_data_access,
    record_campaign_activity,
)
from apps.jobs.models import Job

from ..models import Application, ApplicationStatusHistory

STATUS_TIMESTAMP_FIELD = {
    Application.Status.VIEWED: 'viewed_at',
    Application.Status.SHORTLISTED: 'shortlisted_at',
    Application.Status.INTERVIEWED: 'interviewed_at',
    Application.Status.REJECTED: 'rejected_at',
    Application.Status.ACCEPTED: 'accepted_at',
}

MAX_APPLICATIONS_PER_JOB = 3
REAPPLICATION_COOLDOWN = timedelta(minutes=5)
AUTO_REJECTION_EMAIL_GRACE = timedelta(days=3)

# An employer may skip an intermediate review step, but cannot reopen or move a
# terminal decision backwards. Keeping this graph here gives API and future
# async/admin mutations one source of truth.
ALLOWED_STATUS_TRANSITIONS = {
    Application.Status.SUBMITTED: {
        Application.Status.VIEWED,
        Application.Status.CONSIDERING,
        Application.Status.SHORTLISTED,
        Application.Status.INTERVIEWED,
        Application.Status.REJECTED,
        Application.Status.ACCEPTED,
    },
    Application.Status.VIEWED: {
        Application.Status.CONSIDERING,
        Application.Status.SHORTLISTED,
        Application.Status.INTERVIEWED,
        Application.Status.REJECTED,
        Application.Status.ACCEPTED,
    },
    Application.Status.SHORTLISTED: {
        Application.Status.INTERVIEWED,
        Application.Status.REJECTED,
        Application.Status.ACCEPTED,
    },
    Application.Status.CONSIDERING: {
        Application.Status.SHORTLISTED,
        Application.Status.INTERVIEWED,
        Application.Status.REJECTED,
        Application.Status.ACCEPTED,
    },
    Application.Status.INTERVIEWED: {
        Application.Status.REJECTED,
        Application.Status.ACCEPTED,
    },
    Application.Status.REJECTED: set(),
    Application.Status.ACCEPTED: set(),
}


class InvalidApplicationStatusTransition(ValueError):
    """Raised when an application is moved backwards or reopened."""


class InvalidReapplication(ValueError):
    """Raised when a candidate exceeds the retry limit or cooldown."""


class RecruitmentResourceChanged(APIException):
    status_code = HTTPStatus.CONFLICT
    default_code = 'RECRUITMENT_RESOURCE_CHANGED'

    def __init__(self):
        super().__init__(
            detail={
                'code': self.default_code,
                'message': 'Chiến dịch của hồ sơ vừa thay đổi. Vui lòng tải lại.',
                'action': 'reload',
            },
            code=self.default_code,
        )


def _locked_recruiter_application(application, *, changed_by):
    """Lock U → R → V → Campaign → Job → Application for recruiter writes."""
    ensure_recruiter_candidate_data_access(changed_by, lock=True)
    relation = (
        Application.objects.filter(pk=application.pk)
        .values(
            'job_id',
            'job__campaign_id',
        )
        .get()
    )
    if relation['job__campaign_id'] is not None:
        try:
            RecruitmentCampaign.objects.select_for_update(of=('self',)).get(
                pk=relation['job__campaign_id']
            )
        except RecruitmentCampaign.DoesNotExist as error:
            raise RecruitmentResourceChanged() from error
    job = Job.objects.select_for_update(of=('self',)).get(pk=relation['job_id'])
    if job.campaign_id != relation['job__campaign_id']:
        raise RecruitmentResourceChanged()
    locked_application = (
        Application.objects.select_for_update(of=('self',))
        .select_related('candidate', 'job', 'job__campaign')
        .get(pk=application.pk)
    )
    if locked_application.job_id != job.pk or job.posted_by_id != changed_by.pk:
        raise Application.DoesNotExist
    return locked_application


def reapplication_error(candidate, job, *, now=None):
    """Return a user-facing validation error, if this submission is not allowed."""
    now = now or timezone.now()
    recent_applications = Application.objects.filter(candidate=candidate, job=job).order_by(
        '-applied_at'
    )
    application_count = recent_applications.count()
    if application_count >= MAX_APPLICATIONS_PER_JOB:
        return 'Bạn đã dùng hết 2 lượt ứng tuyển lại cho công việc này.'

    latest_application = recent_applications.first()
    if latest_application and latest_application.applied_at > now - REAPPLICATION_COOLDOWN:
        return 'Vui lòng chờ đủ 5 phút kể từ lần ứng tuyển gần nhất trước khi ứng tuyển lại.'
    return None


@transaction.atomic
def create_application_record(
    *,
    candidate,
    job,
    cv,
    cover_letter='',
    source_version=None,
    preferred_locations=(),
    allow_ai_analysis=False,
    data_processing_consent=False,
    contact_name='',
    contact_email='',
    contact_phone='',
):
    """Persist one candidate application and its immutable selected CV snapshot."""
    # Serialise submissions of one candidate, then repeat the validation made
    # by the serializer to protect the five-minute limit from concurrent POSTs.
    candidate = lock_account_for_write(candidate)
    error = reapplication_error(candidate, job)
    if error:
        raise InvalidReapplication(error)
    snapshot = create_application_snapshot(cv, candidate, source_version=source_version)
    application = Application.objects.create(
        candidate=candidate,
        job=job,
        cv=cv,
        submitted_cv_version=snapshot,
        submitted_cv_title=cv.title,
        submitted_cv_source=cv.source,
        submitted_at=timezone.now(),
        cover_letter=cover_letter,
        allow_ai_analysis=allow_ai_analysis,
        data_processing_consent=data_processing_consent,
        contact_name=contact_name,
        contact_email=contact_email,
        contact_phone=contact_phone,
    )
    application.preferred_locations.set(preferred_locations)
    ApplicationStatusHistory.objects.create(
        application=application,
        from_status='',
        to_status=Application.Status.SUBMITTED,
    )
    job.__class__.objects.filter(pk=job.pk).update(application_count=F('application_count') + 1)
    if job.campaign_id:
        record_campaign_activity(
            campaign=job.campaign,
            event_type=CampaignActivity.EventType.APPLICATION_RECEIVED,
            group=CampaignActivity.Group.APPLICATION,
            actor=candidate,
            subject_public_id=application.public_id,
            metadata={
                'candidate_name': candidate.full_name or candidate.email,
                'job_title': job.title,
            },
        )
    return application


@transaction.atomic
def create_application(serializer, candidate):
    """Compatibility adapter for the legacy application serializer."""
    candidate = lock_account_for_write(candidate)
    cv = serializer.validated_data['cv']
    snapshot = create_application_snapshot(cv, candidate)
    application = serializer.save(
        candidate=candidate,
        submitted_cv_version=snapshot,
        submitted_cv_title=cv.title,
        submitted_cv_source=cv.source,
        submitted_at=timezone.now(),
    )
    ApplicationStatusHistory.objects.create(
        application=application,
        from_status='',
        to_status=Application.Status.SUBMITTED,
    )
    application.job.__class__.objects.filter(pk=application.job_id).update(
        application_count=F('application_count') + 1
    )
    if application.job.campaign_id:
        record_campaign_activity(
            campaign=application.job.campaign,
            event_type=CampaignActivity.EventType.APPLICATION_RECEIVED,
            group=CampaignActivity.Group.APPLICATION,
            actor=candidate,
            subject_public_id=application.public_id,
            metadata={
                'candidate_name': candidate.full_name or candidate.email,
                'job_title': application.job.title,
            },
        )
    return application


@transaction.atomic
def update_application_status(serializer, *, changed_by=None):
    """Persist one valid status transition and its timestamp exactly once."""
    if changed_by is not None and changed_by.is_employer:
        application = _locked_recruiter_application(serializer.instance, changed_by=changed_by)
    else:
        if changed_by is not None:
            lock_account_for_write(changed_by)
        application = (
            Application.objects.select_for_update()
            .select_related('candidate', 'job', 'job__campaign')
            .get(pk=serializer.instance.pk)
        )
    serializer.instance = application
    current_status = application.status
    next_status = serializer.validated_data.get('status', current_status)
    now = timezone.now()
    reversible_auto_rejection = bool(
        current_status == Application.Status.REJECTED
        and application.auto_rejected_at
        and application.auto_rejection_email_sent_at is None
        and application.auto_rejected_at + AUTO_REJECTION_EMAIL_GRACE > now
    )
    candidate = application.candidate.__class__.objects.select_for_update().get(
        pk=application.candidate_id
    )
    if (
        next_status != current_status
        and next_status != Application.Status.REJECTED
        and not is_account_accessible(candidate)
    ):
        raise InvalidApplicationStatusTransition(
            'Ứng viên đang bị hạn chế tài khoản. Chỉ được chuyển hồ sơ sang trạng thái từ chối.'
        )

    if (
        next_status != current_status
        and next_status not in ALLOWED_STATUS_TRANSITIONS[current_status]
        and not reversible_auto_rejection
    ):
        raise InvalidApplicationStatusTransition(
            f'Cannot change application status from {current_status} to {next_status}.',
        )

    timestamp_field = (
        STATUS_TIMESTAMP_FIELD.get(next_status) if next_status != current_status else None
    )
    save_values = {timestamp_field: now} if timestamp_field else {}
    if next_status != current_status:
        save_values.update(
            status_updated_at=now,
            auto_rejection_reminder_sent_at=None,
        )
        if reversible_auto_rejection:
            save_values.update(
                rejected_at=None,
                auto_rejected_at=None,
                auto_rejection_email_sent_at=None,
            )
    application = serializer.save(**save_values)
    if next_status != current_status and getattr(application, 'pk', None):
        ApplicationStatusHistory.objects.create(
            application=application,
            from_status=current_status,
            to_status=next_status,
            changed_by=changed_by,
            note=serializer.validated_data.get('employer_note', ''),
        )
        if application.job.campaign_id:
            record_campaign_activity(
                campaign=application.job.campaign,
                event_type=CampaignActivity.EventType.APPLICATION_STATUS_CHANGED,
                group=CampaignActivity.Group.APPLICATION,
                actor=changed_by,
                subject_public_id=application.public_id,
                metadata={
                    'candidate_name': (
                        application.candidate.full_name or application.candidate.email
                    ),
                    'job_title': application.job.title,
                    'from_status': current_status,
                    'to_status': next_status,
                },
            )
    return application


@transaction.atomic
def mark_application_viewed(application, *, changed_by):
    application = _locked_recruiter_application(application, changed_by=changed_by)
    candidate = application.candidate.__class__.objects.select_for_update().get(
        pk=application.candidate_id
    )
    if not is_account_accessible(candidate):
        raise InvalidApplicationStatusTransition(
            'Ứng viên đang bị hạn chế tài khoản. Không thể đánh dấu hồ sơ đã xem.'
        )
    if application.status != Application.Status.SUBMITTED:
        return application
    application.status = Application.Status.VIEWED
    application.viewed_at = timezone.now()
    application.status_updated_at = application.viewed_at
    application.auto_rejection_reminder_sent_at = None
    application.save(
        update_fields=[
            'status',
            'viewed_at',
            'status_updated_at',
            'auto_rejection_reminder_sent_at',
            'updated_at',
        ]
    )
    ApplicationStatusHistory.objects.create(
        application=application,
        from_status=Application.Status.SUBMITTED,
        to_status=Application.Status.VIEWED,
        changed_by=changed_by,
    )
    if application.job.campaign_id:
        record_campaign_activity(
            campaign=application.job.campaign,
            event_type=CampaignActivity.EventType.APPLICATION_STATUS_CHANGED,
            group=CampaignActivity.Group.APPLICATION,
            actor=changed_by,
            subject_public_id=application.public_id,
            metadata={
                'candidate_name': (application.candidate.full_name or application.candidate.email),
                'job_title': application.job.title,
                'from_status': Application.Status.SUBMITTED,
                'to_status': Application.Status.VIEWED,
            },
        )
    return application
