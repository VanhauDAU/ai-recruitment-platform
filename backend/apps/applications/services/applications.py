"""Write workflows for the applications domain."""

from django.db import transaction
from django.utils import timezone

from apps.cvs.services import create_application_snapshot

from ..models import Application

STATUS_TIMESTAMP_FIELD = {
    Application.Status.VIEWED: 'viewed_at',
    Application.Status.SHORTLISTED: 'shortlisted_at',
    Application.Status.INTERVIEWED: 'interviewed_at',
    Application.Status.REJECTED: 'rejected_at',
    Application.Status.ACCEPTED: 'accepted_at',
}

# An employer may skip an intermediate review step, but cannot reopen or move a
# terminal decision backwards. Keeping this graph here gives API and future
# async/admin mutations one source of truth.
ALLOWED_STATUS_TRANSITIONS = {
    Application.Status.SUBMITTED: {
        Application.Status.VIEWED,
        Application.Status.SHORTLISTED,
        Application.Status.INTERVIEWED,
        Application.Status.REJECTED,
        Application.Status.ACCEPTED,
    },
    Application.Status.VIEWED: {
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
    Application.Status.INTERVIEWED: {
        Application.Status.REJECTED,
        Application.Status.ACCEPTED,
    },
    Application.Status.REJECTED: set(),
    Application.Status.ACCEPTED: set(),
}


class InvalidApplicationStatusTransition(ValueError):
    """Raised when an application is moved backwards or reopened."""


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
    return application


@transaction.atomic
def create_application(serializer, candidate):
    """Compatibility adapter for the legacy application serializer."""
    cv = serializer.validated_data['cv']
    snapshot = create_application_snapshot(cv, candidate)
    return serializer.save(
        candidate=candidate,
        submitted_cv_version=snapshot,
        submitted_cv_title=cv.title,
        submitted_cv_source=cv.source,
        submitted_at=timezone.now(),
    )


@transaction.atomic
def update_application_status(serializer):
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
    return serializer.save(**({timestamp_field: timezone.now()} if timestamp_field else {}))
