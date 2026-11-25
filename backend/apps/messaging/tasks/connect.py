from celery import shared_task

from ..models import InterviewAppointment
from ..services import send_interview_calendar as _send_calendar
from ..services import send_interview_reminders as _send_reminders
from ..services import send_unread_message_emails as _send_unread


@shared_task(name='apps.messaging.tasks.send_unread_message_emails')
def send_unread_message_emails():
    return _send_unread()


@shared_task(name='apps.messaging.tasks.send_interview_reminders')
def send_interview_reminders():
    return _send_reminders()


@shared_task(
    name='apps.messaging.tasks.send_interview_calendar',
    autoretry_for=(OSError,),
    retry_backoff=True,
    max_retries=3,
)
def send_interview_calendar(interview_id):
    interview = (
        InterviewAppointment.objects.select_related(
            'conversation__job__posted_by', 'conversation__company', 'conversation__candidate'
        )
        .filter(pk=interview_id)
        .first()
    )
    return _send_calendar(interview) if interview else 0
