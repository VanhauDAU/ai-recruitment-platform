from celery import shared_task

from ..services import purge_lapsed_talent_pool_entries as purge


@shared_task(name='apps.applications.tasks.purge_lapsed_talent_pool_entries')
def purge_lapsed_talent_pool_entries():
    return purge()
