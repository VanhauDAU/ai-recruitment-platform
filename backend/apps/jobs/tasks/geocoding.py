"""Background geocoding of workplace addresses (ADR-0029)."""

from celery import shared_task

from apps.locations.services import GeocodingUnavailable

from ..services.coordinates import geocode_pending_locations


@shared_task(bind=True, max_retries=3, default_retry_delay=120, ignore_result=True)
def geocode_job_locations(self, job_id):
    try:
        return geocode_pending_locations(job_id)
    except GeocodingUnavailable as error:
        raise self.retry(exc=error) from error
