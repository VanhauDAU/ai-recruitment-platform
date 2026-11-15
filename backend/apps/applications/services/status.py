"""Recruiter decisions on an application and the candidate notice each schedules.

Pipeline: ``submitted`` and ``viewed`` are facts the system records; the
recruiter answers with one of ``Application.DECISION_STATUSES``. A decision
reaches the candidate only after ``CANDIDATE_STATUS_NOTIFICATION_DELAY``; until
then the recruiter may undo it and a newer decision replaces the older notice.
"""

from datetime import timedelta
from http import HTTPStatus

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import APIException

from apps.accounts.services import is_account_accessible
from apps.candidates.models import CandidateNotification
from apps.candidates.services import (
    cancel_candidate_notification,
    emit_candidate_notification,
    restore_superseded_candidate_notification,
)
from apps.employers.models import CampaignActivity
from apps.employers.services import record_campaign_activity

from ..models import Application, ApplicationStatusHistory
from .locking import lock_recruiter_application

Status = Application.Status
AUTO_REJECTION_EMAIL_GRACE = timedelta(days=3)

STATUS_TIMESTAMP_FIELD = {
    Status.VIEWED: 'viewed_at',
    Status.SHORTLISTED: 'shortlisted_at',
    Status.INTERVIEWED: 'interviewed_at',
    Status.REJECTED: 'rejected_at',
    Status.ACCEPTED: 'accepted_at',
}

# Forward-only: a recruiter may skip a step but never reopen a terminal one.
ALLOWED_STATUS_TRANSITIONS = {
    Status.SUBMITTED: set(Application.DECISION_STATUSES),
    Status.VIEWED: set(Application.DECISION_STATUSES),
    Status.SHORTLISTED: {Status.INTERVIEWED, Status.ACCEPTED, Status.REJECTED},
    Status.INTERVIEWED: {Status.ACCEPTED, Status.REJECTED},
    Status.ACCEPTED: set(),
    Status.REJECTED: set(),
    # The candidate withdrew; nothing is left for the recruiter to decide.
    Status.WITHDRAWN: set(),
}

NOTICE_EVENT = {
    Status.VIEWED: CandidateNotification.EventType.APPLICATION_VIEWED,
    Status.SHORTLISTED: CandidateNotification.EventType.APPLICATION_SHORTLISTED,
    Status.INTERVIEWED: CandidateNotification.EventType.APPLICATION_INTERVIEWED,
    Status.ACCEPTED: CandidateNotification.EventType.APPLICATION_ACCEPTED,
    Status.REJECTED: CandidateNotification.EventType.APPLICATION_REJECTED,
}


class InvalidApplicationStatusTransition(ValueError):
    """Raised when an application is moved backwards or reopened."""


class StatusChangeNotUndoable(APIException):
    status_code = HTTPStatus.CONFLICT
    default_code = 'STATUS_UNDO_UNAVAILABLE'

    def __init__(self, message):
        super().__init__(detail={'code': self.default_code, 'message': message})


def decision_supersede_key(application):
    return f'application-decision:{application.public_id}'


def _reversible_auto_rejection(application, now):
    return bool(
        application.status == Status.REJECTED
        and application.auto_rejected_at
        and application.auto_rejection_email_sent_at is None
        and application.auto_rejected_at + AUTO_REJECTION_EMAIL_GRACE > now
    )


def available_status_decisions(application, *, now=None):
    """Decisions the recruiter may take now; pure, reads loaded relations only."""
    now = now or timezone.now()
    if _reversible_auto_rejection(application, now):
        allowed = set(Application.DECISION_STATUSES) - {Status.REJECTED}
    else:
        allowed = ALLOWED_STATUS_TRANSITIONS[application.status]
    if not is_account_accessible(application.candidate):
        allowed = allowed & {Status.REJECTED}
    return [status for status in Application.DECISION_STATUSES if status in allowed]


def notify_candidate_of_status(application, history, *, deliver_after, send_email=True):
    """Schedule the candidate notice for one history row (keyed by that row)."""
    is_decision = history.to_status in Application.DECISION_STATUSES
    return emit_candidate_notification(
        recipient=application.candidate,
        event_type=NOTICE_EVENT[history.to_status],
        dedupe_key=history.notification_key,
        supersede_key=decision_supersede_key(application) if is_decision else '',
        deliver_after=deliver_after,
        send_email=send_email,
        context={
            'company_name': application.job.company.company_name,
            'job_title': application.job.title,
        },
        metadata={
            'application_public_id': application.public_id,
            'job_public_id': application.job.public_id,
        },
    )


def _record_status_activity(application, *, actor, from_status, to_status):
    if not application.job.campaign_id:
        return
    record_campaign_activity(
        campaign=application.job.campaign,
        event_type=CampaignActivity.EventType.APPLICATION_STATUS_CHANGED,
        group=CampaignActivity.Group.APPLICATION,
        actor=actor,
        subject_public_id=application.public_id,
        metadata={
            'candidate_name': application.candidate.full_name or application.candidate.email,
            'job_title': application.job.title,
            'from_status': from_status,
            'to_status': to_status,
        },
    )


def _lock_with_candidate(application, *, changed_by):
    application = lock_recruiter_application(application, changed_by=changed_by)
    # Lock the candidate too: account restriction must not change mid-decision.
    application.candidate = application.candidate.__class__.objects.select_for_update().get(
        pk=application.candidate_id
    )
    return application


@transaction.atomic
def change_application_status(application, *, changed_by, status):
    """Apply one recruiter decision; returns ``(application, candidate_notice)``."""
    application = _lock_with_candidate(application, changed_by=changed_by)
    now = timezone.now()
    if status not in available_status_decisions(application, now=now):
        if not is_account_accessible(application.candidate):
            message = (
                'Ứng viên đang bị hạn chế tài khoản. '
                'Chỉ được chuyển hồ sơ sang trạng thái Không phù hợp.'
            )
        else:
            message = (
                f'Không thể chuyển hồ sơ từ "{Status(application.status).label}" '
                f'sang "{Status(status).label}".'
            )
        raise InvalidApplicationStatusTransition(message)

    previous_status = application.status
    changes = {
        'status': status,
        STATUS_TIMESTAMP_FIELD[status]: now,
        'status_updated_at': now,
        'auto_rejection_reminder_sent_at': None,
    }
    if _reversible_auto_rejection(application, now):
        changes.update(rejected_at=None, auto_rejected_at=None, auto_rejection_email_sent_at=None)
    for field, value in changes.items():
        setattr(application, field, value)
    application.save(update_fields=[*changes, 'updated_at'])
    history = ApplicationStatusHistory.objects.create(
        application=application,
        from_status=previous_status,
        to_status=status,
        changed_by=changed_by,
    )
    notice = notify_candidate_of_status(
        application,
        history,
        deliver_after=now + settings.CANDIDATE_STATUS_NOTIFICATION_DELAY,
    )
    _record_status_activity(
        application, actor=changed_by, from_status=previous_status, to_status=status
    )
    return application, notice


def _active_history(application):
    return application.status_history.filter(reverted_at__isnull=True).order_by(
        '-created_at', '-id'
    )


def undoable_status_history(application, *, user):
    """The latest active row if ``user`` may undo it (notice state aside)."""
    history = _active_history(application).first()
    if (
        history is None
        or history.to_status not in Application.DECISION_STATUSES
        or history.to_status != application.status
        or history.changed_by_id != user.pk
        # Reopening an automatic rejection cleared its audit fields; undoing it
        # would leave a rejection without them, so it stays final.
        or history.from_status in Application.TERMINAL_STATUSES
    ):
        return None
    return history


@transaction.atomic
def undo_latest_status_change(application, *, changed_by):
    """Revert the recruiter's own latest decision while the candidate is unaware."""
    application = lock_recruiter_application(application, changed_by=changed_by)
    history = undoable_status_history(application, user=changed_by)
    if history is None:
        raise StatusChangeNotUndoable('Không có thay đổi nào của bạn có thể hoàn tác.')
    if not cancel_candidate_notification(
        recipient_id=application.candidate_id, dedupe_key=history.notification_key
    ):
        raise StatusChangeNotUndoable(
            'Ứng viên đã nhận thông báo về thay đổi này nên không thể hoàn tác.'
        )

    now = timezone.now()
    undone_status = application.status
    application.status = history.from_status
    setattr(application, STATUS_TIMESTAMP_FIELD[undone_status], None)
    # Restarting the clock is deliberate: the forward change cleared the
    # auto-rejection reminder, so the old timestamp could auto-reject the
    # application on the next tick without warning the recruiter.
    application.status_updated_at = now
    application.save(
        update_fields=[
            'status',
            STATUS_TIMESTAMP_FIELD[undone_status],
            'status_updated_at',
            'updated_at',
        ]
    )
    history.reverted_at = now
    history.save(update_fields=['reverted_at'])

    previous = _active_history(application).first()
    if previous is not None and previous.to_status in Application.DECISION_STATUSES:
        # The undone notice had superseded this one; the candidate must still
        # learn the decision that is current again.
        restore_superseded_candidate_notification(
            recipient_id=application.candidate_id,
            dedupe_key=previous.notification_key,
            deliver_after=now + settings.CANDIDATE_STATUS_NOTIFICATION_DELAY,
        )
    _record_status_activity(
        application, actor=changed_by, from_status=undone_status, to_status=application.status
    )
    return application


_UNSET = object()


@transaction.atomic
def update_application_assessment(
    application, *, changed_by, employer_note=_UNSET, employer_rating=_UNSET
):
    """Save the private note/rating; never a status change, never a notice."""
    application = lock_recruiter_application(application, changed_by=changed_by)
    changes = {
        field: value
        for field, value in (('employer_note', employer_note), ('employer_rating', employer_rating))
        if value is not _UNSET
    }
    for field, value in changes.items():
        setattr(application, field, value)
    if changes:
        application.save(update_fields=[*changes, 'updated_at'])
    return application


@transaction.atomic
def mark_application_viewed(application, *, changed_by):
    """Record the first recruiter view; idempotent and silent for restricted accounts."""
    application = _lock_with_candidate(application, changed_by=changed_by)
    if application.status != Status.SUBMITTED or not is_account_accessible(application.candidate):
        return application
    now = timezone.now()
    application.status = Status.VIEWED
    application.viewed_at = now
    application.status_updated_at = now
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
    history = ApplicationStatusHistory.objects.create(
        application=application,
        from_status=Status.SUBMITTED,
        to_status=Status.VIEWED,
        changed_by=changed_by,
    )
    notify_candidate_of_status(application, history, deliver_after=now)
    _record_status_activity(
        application, actor=changed_by, from_status=Status.SUBMITTED, to_status=Status.VIEWED
    )
    return application
