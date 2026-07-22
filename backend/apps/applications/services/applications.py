"""Write workflows for the applications domain."""

from datetime import timedelta

from django.db import transaction
from django.db.models import F
from django.utils import timezone

from apps.cvs.services import create_application_snapshot

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
    candidate.__class__.objects.select_for_update().get(pk=candidate.pk)
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
    return application


@transaction.atomic
def create_application(serializer, candidate):
    """Compatibility adapter for the legacy application serializer."""
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
    return application


@transaction.atomic
def update_application_status(serializer, *, changed_by=None):
    """Persist one valid status transition and its timestamp exactly once."""
    current_status = serializer.instance.status
    next_status = serializer.validated_data.get('status', current_status)

    if (
        next_status != current_status
        and next_status not in ALLOWED_STATUS_TRANSITIONS[current_status]
    ):
        raise InvalidApplicationStatusTransition(
            f'Cannot change application status from {current_status} to {next_status}.',
        )

    timestamp_field = (
        STATUS_TIMESTAMP_FIELD.get(next_status) if next_status != current_status else None
    )
    application = serializer.save(**({timestamp_field: timezone.now()} if timestamp_field else {}))
    if next_status != current_status and getattr(application, 'pk', None):
        ApplicationStatusHistory.objects.create(
            application=application,
            from_status=current_status,
            to_status=next_status,
            changed_by=changed_by,
            note=serializer.validated_data.get('employer_note', ''),
        )
    return application


@transaction.atomic
def mark_application_viewed(application, *, changed_by):
    if application.status != Application.Status.SUBMITTED:
        return application
    application.status = Application.Status.VIEWED
    application.viewed_at = timezone.now()
    application.save(update_fields=['status', 'viewed_at', 'updated_at'])
    ApplicationStatusHistory.objects.create(
        application=application,
        from_status=Application.Status.SUBMITTED,
        to_status=Application.Status.VIEWED,
        changed_by=changed_by,
    )
    return application
