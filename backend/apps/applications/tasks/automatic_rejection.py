from celery import shared_task

from ..services import process_automatic_application_rejections as process_rejections


@shared_task(name='apps.applications.tasks.process_automatic_application_rejections')
def process_automatic_application_rejections():
    return process_rejections()
