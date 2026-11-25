"""Background geocoding of workplace addresses (ADR-0029)."""

from celery import shared_task

from apps.locations.services import GeocodingUnavailable

from ..services.coordinates import geocode_pending_locations, pending_geocode_job_ids

SWEEP_BATCH = 50


@shared_task(bind=True, max_retries=3, default_retry_delay=120, ignore_result=True)
def geocode_job_locations(self, job_id):
    try:
        return geocode_pending_locations(job_id)
    except GeocodingUnavailable as error:
        raise self.retry(exc=error) from error


@shared_task(ignore_result=True)
def geocode_pending_job_locations():
    """Beat sweep: picks up rows whose on-commit dispatch was lost (worker down,
    broker restart) or that were backfilled by migration. Stops at the first
    provider outage; the next run continues."""
    for job_id in pending_geocode_job_ids(SWEEP_BATCH):
        try:
            geocode_pending_locations(job_id)
        except GeocodingUnavailable:
            return
