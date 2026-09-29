from celery import shared_task

from ..services import (
    expire_due_entitlement_units,
    expire_due_job_service_activations,
)
from ..services import (
    purge_saved_job_remarketing_history as purge_saved_remarketing_service,
)


@shared_task(name='apps.services.tasks.expire_service_inventory_and_activations')
def expire_service_inventory_and_activations():
    return {
        'units': expire_due_entitlement_units(),
        'activations': expire_due_job_service_activations(),
    }


@shared_task(name='apps.services.tasks.purge_saved_job_remarketing_history')
def purge_saved_job_remarketing_history():
    return purge_saved_remarketing_service()
