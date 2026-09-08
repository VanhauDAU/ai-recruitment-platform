from datetime import timedelta

from celery import shared_task
from django.conf import settings
from django.utils import timezone

from common.metrics import record_metric

from ..models import EmployerActivity, EmployerNotification, EmployerVerificationNotification


@shared_task
def purge_expired_employer_event_history():
    """Apply the documented 24-month retention to recruiter event surfaces."""

    cutoff = timezone.now() - timedelta(days=settings.EMPLOYER_EVENT_RETENTION_DAYS)
    notification_count, _ = EmployerNotification.objects.filter(created_at__lt=cutoff).delete()
    activity_count, _ = EmployerActivity.objects.filter(occurred_at__lt=cutoff).delete()
    email_outbox_count, _ = EmployerVerificationNotification.objects.filter(
        created_at__lt=cutoff,
        status__in=[
            EmployerVerificationNotification.Status.SENT,
            EmployerVerificationNotification.Status.FAILED,
        ],
    ).delete()
    record_metric(
        'employer_notification_retention',
        value=notification_count + activity_count + email_outbox_count,
        status='purged',
    )
    return {
        'notifications': notification_count,
        'activities': activity_count,
        'email_outbox': email_outbox_count,
    }
