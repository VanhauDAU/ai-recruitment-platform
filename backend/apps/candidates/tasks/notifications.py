"""Beat-driven release and email delivery of candidate notifications.

The dispatcher is the only producer of email tasks, so a notice cancelled
(undone or superseded) before its ``deliver_after`` can never be emailed.
"""

from celery import shared_task

from ..services import (
    deliver_candidate_notification_email,
    pending_candidate_notification_email_ids,
    release_due_candidate_notifications,
)
from ..services import (
    purge_expired_candidate_notifications as purge_expired,
)


@shared_task
def dispatch_candidate_notifications():
    released = release_due_candidate_notifications()
    email_ids = pending_candidate_notification_email_ids()
    for notification_id in email_ids:
        send_candidate_notification_email.delay(notification_id)
    return {'released': released, 'emails': len(email_ids)}


@shared_task
def send_candidate_notification_email(notification_id):
    return deliver_candidate_notification_email(notification_id)


@shared_task
def purge_expired_candidate_notifications():
    return purge_expired()
