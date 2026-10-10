import logging

from celery import shared_task

from ..services import (
    deliver_job_service_alert_recipient as deliver_recipient_service,
)
from ..services import (
    pending_job_service_alert_dispatch_ids,
    pending_job_service_alert_recipient_ids,
)
from ..services import (
    prepare_job_service_alert_dispatch as prepare_dispatch_service,
)

logger = logging.getLogger(__name__)


@shared_task(name='apps.services.tasks.prepare_job_service_alert_dispatch')
def prepare_job_service_alert_dispatch(dispatch_id):
    result = prepare_dispatch_service(dispatch_id=dispatch_id)
    if not result.get('selection_finished', True):
        prepare_job_service_alert_dispatch.delay(dispatch_id)
    for recipient_id in result['recipient_ids']:
        deliver_job_service_alert_recipient.delay(recipient_id)
    return result['status']


@shared_task(
    bind=True,
    max_retries=3,
    name='apps.services.tasks.deliver_job_service_alert_recipient',
)
def deliver_job_service_alert_recipient(self, recipient_id):
    try:
        return deliver_recipient_service(recipient_id)
    except Exception as error:  # noqa: BLE001 - persisted outbox controls retry state
        if self.request.retries >= self.max_retries:
            raise
        raise self.retry(
            exc=error,
            countdown=min(2 ** (self.request.retries + 1), 60),
        ) from error


@shared_task(name='apps.services.tasks.dispatch_pending_job_service_alerts')
def dispatch_pending_job_service_alerts():
    dispatch_ids = pending_job_service_alert_dispatch_ids()
    recipient_ids = pending_job_service_alert_recipient_ids()
    for dispatch_id in dispatch_ids:
        try:
            prepare_job_service_alert_dispatch.delay(dispatch_id)
        except Exception:  # noqa: BLE001 - sweep retries the durable dispatch row
            logger.exception('Không thể dispatch chuẩn bị Job Alert %s.', dispatch_id)
    for recipient_id in recipient_ids:
        try:
            deliver_job_service_alert_recipient.delay(recipient_id)
        except Exception:  # noqa: BLE001 - sweep retries the durable recipient row
            logger.exception('Không thể dispatch gửi Job Alert %s.', recipient_id)
    return {'dispatches': len(dispatch_ids), 'recipients': len(recipient_ids)}
