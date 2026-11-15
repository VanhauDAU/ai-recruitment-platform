"""Candidate submission workflow for the applications domain."""

from datetime import timedelta

from django.db import transaction
from django.db.models import F
from django.utils import timezone

from apps.accounts.services import lock_account_for_write
from apps.candidates.models import CandidateNotification
from apps.candidates.services import emit_candidate_notification
from apps.cvs.services import create_application_snapshot
from apps.employers.models import CampaignActivity
from apps.employers.services import record_campaign_activity, recruiter_readiness_state
from apps.jobs.models import Job, publicly_available_job_filter

from ..models import Application, ApplicationStatusHistory
from .blocks import BLOCKED_APPLY_MESSAGE, is_candidate_blocked
from .recruiter_alerts import alert_recruiter_of_application

MAX_APPLICATIONS_PER_JOB = 3
REAPPLICATION_COOLDOWN = timedelta(minutes=5)


JOB_UNAVAILABLE_MESSAGE = 'Tin tuyển dụng này hiện không nhận hồ sơ.'


class ApplicationNotAllowed(ValueError):
    """Raised when this submission may not be accepted; the message is user-facing."""


def job_accepts_applications(job):
    """A job takes applications only while public and while its poster may open them."""
    if not Job.objects.filter(publicly_available_job_filter(), pk=job.pk).exists():
        return False
    _, readiness = recruiter_readiness_state(job.posted_by)
    return readiness['candidate_data_access']


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
        raise ApplicationNotAllowed(error)
    # Neutral wording: the candidate is never told they were blocked.
    if is_candidate_blocked(recruiter_id=job.posted_by_id, candidate_id=candidate.pk):
        raise ApplicationNotAllowed(BLOCKED_APPLY_MESSAGE)
    if not job_accepts_applications(job):
        raise ApplicationNotAllowed(JOB_UNAVAILABLE_MESSAGE)
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
    # Delivered right away: the candidate's confirmation (bell + email).
    emit_candidate_notification(
        recipient=candidate,
        event_type=CandidateNotification.EventType.APPLICATION_SUBMITTED,
        dedupe_key=f'application-submitted:{application.public_id}',
        context={'company_name': job.company.company_name, 'job_title': job.title},
        metadata={'application_public_id': application.public_id, 'job_public_id': job.public_id},
    )
    alert_recruiter_of_application(application)
    return application
