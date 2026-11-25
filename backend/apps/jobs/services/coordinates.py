"""Coordinates of job workplaces for the nearby-jobs search (ADR-0029).

Order of trust for one ``JobLocation`` row:
1. the employer's pin (validated by the serializer: inside the selected province);
2. a geocoded ``address_detail`` already in ``GeocodeCache``;
3. the ward centroid — and when an address exists but is not cached yet the row
   is marked ``geocode_pending`` so the Celery task upgrades it after commit;
4. a province-wide row ("Tất cả") gets no point: distance is meaningless.
"""

import logging

from django.db import transaction

from apps.locations.models import Location
from apps.locations.selectors import province_of_point
from apps.locations.services import GeocodingDisabled, cached_geocode, geocode_address

from ..models import JobLocation

logger = logging.getLogger(__name__)

Precision = JobLocation.Precision
Source = JobLocation.CoordinateSource


def geocode_query(row):
    ward = row.location
    province = ward.parent
    return ', '.join(
        part for part in (row.address_detail, ward.name, province.name if province else '') if part
    )


def _set(row, lat, lng, precision, source, pending=False):
    row.latitude, row.longitude = lat, lng
    row.coordinate_precision, row.coordinate_source = precision, source
    row.geocode_pending = pending


def _point_matches_province(point, province_id):
    province = province_of_point(point.latitude, point.longitude)
    return province is not None and province.pk == province_id


def assign_coordinates(rows):
    """Fill coordinate fields on unsaved rows (``location`` loaded with ``parent``)."""
    for row in rows:
        location = row.location
        if row.coordinate_source == Source.EMPLOYER_PIN and row.latitude is not None:
            _set(row, row.latitude, row.longitude, Precision.EXACT, Source.EMPLOYER_PIN)
            continue
        if location.level == Location.Level.PROVINCE or location.latitude is None:
            _set(row, None, None, Precision.PROVINCE, '')
            continue
        _set(row, location.latitude, location.longitude, Precision.WARD, Source.WARD_CENTROID)
        if not row.address_detail:
            continue
        point, hit = cached_geocode(geocode_query(row))
        if not hit:
            row.geocode_pending = True
        elif point and _point_matches_province(point, location.parent_id):
            _set(row, point.latitude, point.longitude, Precision.EXACT, Source.GEOCODER)
    return rows


def schedule_geocoding(job_id):
    def dispatch():
        # Imported here: tasks depend on services, not the other way round.
        from ..tasks.geocoding import geocode_job_locations

        try:
            geocode_job_locations.delay(job_id)
        except Exception:  # noqa: BLE001 - backfill command picks pending rows up later
            logger.exception('Không thể dispatch geocode cho tin %s.', job_id)

    transaction.on_commit(dispatch)


def geocode_pending_locations(job_id):
    """Upgrade pending rows of one job to geocoded points; ward centroid stays on a
    miss or a result outside the selected province. Raises ``GeocodingError`` for
    transient provider failures so the task can retry; returns rows upgraded."""
    rows = list(
        JobLocation.objects.filter(job_id=job_id, geocode_pending=True).select_related(
            'location__parent'
        )
    )
    upgraded = 0
    for row in rows:
        try:
            point = geocode_address(geocode_query(row))
        except GeocodingDisabled:
            point = None
        if point and _point_matches_province(point, row.location.parent_id):
            _set(row, point.latitude, point.longitude, Precision.EXACT, Source.GEOCODER)
            upgraded += 1
        row.geocode_pending = False
        row.save(
            update_fields=[
                'latitude',
                'longitude',
                'coordinate_precision',
                'coordinate_source',
                'geocode_pending',
                'updated_at',
            ]
        )
    return upgraded


def refresh_job_coordinates(job, *, force=False):
    """Recompute rows of an existing job (backfill/after seeding centroids)."""
    rows = list(job.job_locations.select_related('location__parent'))
    for row in rows:
        if force and row.coordinate_source != Source.EMPLOYER_PIN:
            row.coordinate_source = ''
    assign_coordinates(rows)
    JobLocation.objects.bulk_update(
        rows,
        ['latitude', 'longitude', 'coordinate_precision', 'coordinate_source', 'geocode_pending'],
    )
    if any(row.geocode_pending for row in rows):
        schedule_geocoding(job.pk)
    return rows
