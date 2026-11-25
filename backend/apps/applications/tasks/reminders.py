from celery import shared_task

from ..services import send_interview_decision_email as send_decision_email
from ..services import send_interview_decision_reminders as send_decision_reminders
from ..services import send_unanswered_application_reminders as send_reminders


@shared_task(name='apps.applications.tasks.send_unanswered_application_reminders')
def send_unanswered_application_reminders():
    return send_reminders()


@shared_task(name='apps.applications.tasks.send_interview_decision_reminders')
def send_interview_decision_reminders():
    return send_decision_reminders()


@shared_task(
    name='apps.applications.tasks.send_interview_decision_email',
    autoretry_for=(OSError,),
    retry_backoff=True,
    max_retries=3,
)
def send_interview_decision_email(job_id, application_ids):
    return send_decision_email(job_id, application_ids)
