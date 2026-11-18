from celery import shared_task

from ..services import run_campaign_schedule


@shared_task(name='apps.campaigns.tasks.run_campaign_schedule')
def run_campaign_schedule_task():
    return run_campaign_schedule()
