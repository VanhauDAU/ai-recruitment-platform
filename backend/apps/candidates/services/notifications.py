"""Candidate notification writer, scheduler and email outbox.

The domain that causes an event (applications) owns *when* and *why* a notice
is sent; this module owns *what the candidate sees* and *how it is delivered*.
It never imports the producing app: producers pass opaque keys and the few
display values a template needs.
"""

from __future__ import annotations

import logging
from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from apps.accounts.services import is_account_accessible
from apps.sitecontent.selectors import business_emails_enabled, retention_days
from common.email import send_html_email
from common.metrics import record_metric
from common.outbox import MAX_DELIVERY_ATTEMPTS, is_sending_fresh, stale_sending_before

from ..models import CandidateNotification
from .notification_emails import APPLIED_JOBS_PATH, render_notification_email
from .notification_events import EVENTS, render_text, switch_enabled

logger = logging.getLogger(__name__)

SAFE_METADATA_KEYS = {'application_public_id', 'job_public_id'}

Status = CandidateNotification.EmailStatus


def _undelivered():
    return Q(delivered_at__isnull=True, cancelled_at__isnull=True)


@transaction.atomic
def emit_candidate_notification(
    *,
    recipient,
    event_type,
    dedupe_key,
    context,
    supersede_key='',
    deliver_after=None,
    send_email=True,
    metadata=None,
    action_path=APPLIED_JOBS_PATH,
):
    """Idempotently schedule one notice inside the caller's transaction.

    ``supersede_key`` groups notices where only the latest still matters (the
    recruiter's current decision on one application): scheduling a new one
    cancels the older notices of the group that the candidate has not seen.
    Nothing is enqueued here; the dispatcher releases due rows, so a rolled
    back caller can never leak a notice.
    """
    if event_type not in EVENTS:
        raise ValueError('CANDIDATE_EVENT_TYPE_UNSUPPORTED')
    dedupe_key = str(dedupe_key).strip()[:160]
    if not dedupe_key:
        raise ValueError('CANDIDATE_EVENT_DEDUPE_REQUIRED')
    now = timezone.now()
    if supersede_key:
        CandidateNotification.objects.filter(
            _undelivered(), recipient=recipient, supersede_key=supersede_key
        ).exclude(dedupe_key=dedupe_key).update(
            cancelled_at=now,
            cancel_reason=CandidateNotification.CancelReason.SUPERSEDED,
        )
    spec = EVENTS[event_type]
    notification, created = CandidateNotification.objects.get_or_create(
        recipient=recipient,
        dedupe_key=dedupe_key,
        defaults={
            'event_type': event_type,
            'supersede_key': supersede_key[:160],
            'title': render_text(spec.title, context)[:180],
            'message': render_text(spec.message, context),
            'action_path': action_path,
            # The website switch is read now; the email switch at send time.
            'show_in_inbox': switch_enabled(recipient.pk, spec.web_switch),
            'metadata': {
                key: str(value)[:100]
                for key, value in (metadata or {}).items()
                if key in SAFE_METADATA_KEYS and value
            },
            'deliver_after': deliver_after or now,
            'email_status': Status.PENDING if send_email else Status.SKIPPED,
        },
    )
    record_metric(
        'candidate_notification_event',
        event=event_type,
        status='created' if created else 'deduplicated',
    )
    return notification


def cancel_candidate_notification(*, recipient_id, dedupe_key):
    """Withdraw a notice the candidate has not received; False once released."""
    updated = CandidateNotification.objects.filter(
        _undelivered(), recipient_id=recipient_id, dedupe_key=dedupe_key
    ).update(
        cancelled_at=timezone.now(),
        cancel_reason=CandidateNotification.CancelReason.UNDONE,
    )
    return updated == 1


def restore_superseded_candidate_notification(*, recipient_id, dedupe_key, deliver_after):
    """Reschedule a notice that an undone, newer notice had replaced."""
    return (
        CandidateNotification.objects.filter(
            recipient_id=recipient_id,
            dedupe_key=dedupe_key,
            delivered_at__isnull=True,
            cancel_reason=CandidateNotification.CancelReason.SUPERSEDED,
        ).update(cancelled_at=None, cancel_reason='', deliver_after=deliver_after)
        == 1
    )


def release_due_candidate_notifications(*, now=None, batch_size=500):
    """Make due notices visible; the WHERE re-check loses cleanly to an undo."""
    now = now or timezone.now()
    due_ids = list(
        CandidateNotification.objects.filter(_undelivered(), deliver_after__lte=now)
        .order_by('deliver_after', 'pk')
        .values_list('pk', flat=True)[:batch_size]
    )
    if not due_ids:
        return 0
    return CandidateNotification.objects.filter(_undelivered(), pk__in=due_ids).update(
        delivered_at=now
    )


def pending_candidate_notification_email_ids(*, now=None, limit=100):
    now = now or timezone.now()
    return list(
        CandidateNotification.objects.filter(delivered_at__isnull=False)
        .filter(
            Q(email_status=Status.PENDING)
            | Q(email_status=Status.SENDING, email_started_at__lt=stale_sending_before(now))
        )
        .order_by('delivered_at', 'pk')
        .values_list('pk', flat=True)[:limit]
    )


def _email_skip_reason(notification):
    recipient = notification.recipient
    if not recipient.email:
        return 'no_email'
    if not recipient.email_verified:
        return 'email_unverified'
    if not is_account_accessible(recipient):
        return 'account_restricted'
    if not business_emails_enabled():
        return 'site_disabled'
    # Re-read at send time: the candidate may have changed it since the event.
    if not switch_enabled(recipient.pk, EVENTS[notification.event_type].email_switch):
        return 'preference_disabled'
    return ''


def deliver_candidate_notification_email(notification_id):
    """Send one released notice by email exactly once; returns the email status.

    Preferences and account state are re-read right before sending because the
    candidate may change them between the event and the delivery. A failure is
    stored back as PENDING so the next dispatcher tick retries it.
    """
    now = timezone.now()
    with transaction.atomic():
        notification = (
            CandidateNotification.objects.select_for_update(of=('self',))
            .select_related('recipient')
            .filter(pk=notification_id, delivered_at__isnull=False)
            .first()
        )
        if notification is None or notification.email_status in {
            Status.SENT,
            Status.SKIPPED,
            Status.FAILED,
        }:
            return None
        if notification.email_status == Status.SENDING and is_sending_fresh(
            notification.email_started_at, now
        ):
            return None
        skip_reason = _email_skip_reason(notification)
        if skip_reason:
            notification.email_status = Status.SKIPPED
            notification.save(update_fields=['email_status'])
            record_metric('candidate_notification_email', status=Status.SKIPPED, reason=skip_reason)
            return Status.SKIPPED
        notification.email_status = Status.SENDING
        notification.email_started_at = now
        notification.email_attempts += 1
        notification.save(update_fields=['email_status', 'email_started_at', 'email_attempts'])

    try:
        subject, text, html, from_email, reply_to = render_notification_email(notification)
        send_html_email(
            subject=subject,
            text=text,
            html=html,
            to=notification.recipient.email,
            from_email=from_email,
            reply_to=reply_to,
        )
    except Exception as error:  # noqa: BLE001 - the outbox row owns the retry state
        status = (
            Status.FAILED
            if notification.email_attempts >= MAX_DELIVERY_ATTEMPTS
            else Status.PENDING
        )
        CandidateNotification.objects.filter(pk=notification.pk).update(
            email_status=status, email_last_error=str(error)[:2000]
        )
        logger.warning('Candidate notification email %s failed: %s', notification.pk, status)
        record_metric('candidate_notification_email', status=status)
        return status

    CandidateNotification.objects.filter(pk=notification.pk).update(
        email_status=Status.SENT, email_sent_at=timezone.now(), email_last_error=''
    )
    record_metric('candidate_notification_email', status=Status.SENT)
    return Status.SENT


def mark_candidate_notification_read(user, public_id):
    """Return the delivered notice marked read, or None when it is not the user's."""
    notification = (
        CandidateNotification.objects.filter(
            recipient=user, public_id=public_id, delivered_at__isnull=False, show_in_inbox=True
        )
        .only('pk', 'read_at')
        .first()
    )
    if notification is None:
        return None
    if notification.read_at is None:
        CandidateNotification.objects.filter(pk=notification.pk, read_at__isnull=True).update(
            read_at=timezone.now()
        )
    return CandidateNotification.objects.get(pk=notification.pk)


def mark_all_candidate_notifications_read(user):
    return CandidateNotification.objects.filter(
        recipient=user, delivered_at__isnull=False, show_in_inbox=True, read_at__isnull=True
    ).update(read_at=timezone.now())


def purge_expired_candidate_notifications(*, now=None):
    cutoff = (now or timezone.now()) - timedelta(
        days=retention_days(
            'candidate_notification_retention_days',
            settings.CANDIDATE_NOTIFICATION_RETENTION_DAYS,
            minimum=30,
        )
    )
    deleted, _ = CandidateNotification.objects.filter(created_at__lt=cutoff).delete()
    return deleted
