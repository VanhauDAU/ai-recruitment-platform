from celery import shared_task

from ..services import send_unanswered_application_reminders as send_reminders


@shared_task(name='apps.applications.tasks.send_unanswered_application_reminders')
def send_unanswered_application_reminders():
    return send_reminders()
