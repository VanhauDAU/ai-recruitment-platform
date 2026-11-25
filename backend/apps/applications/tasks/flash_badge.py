from celery import shared_task

from ..services import refresh_flash_badges as refresh


@shared_task(name='apps.applications.tasks.refresh_flash_badges')
def refresh_flash_badges():
    return refresh()
