from celery import shared_task

from ..services import send_new_application_email as send


@shared_task(
    name='apps.applications.tasks.send_new_application_email',
    autoretry_for=(OSError,),
    retry_backoff=True,
    max_retries=3,
)
def send_new_application_email(application_id):
    return send(application_id)
