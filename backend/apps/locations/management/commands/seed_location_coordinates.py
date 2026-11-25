import json

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.locations.models import Location

from .build_location_centroids import DEFAULT_OUTPUT

CENTROID_SOURCE = 'boundary'


class Command(BaseCommand):
    help = (
        'Load ward/province centroids from apps/locations/seed_data/centroids.json '
        '(no network). Run after seed_locations; idempotent.'
    )

    def handle(self, *args, **options):
        points = json.loads(DEFAULT_OUTPUT.read_text(encoding='utf-8'))['locations']
        updated = 0
        with transaction.atomic():
            rows = list(Location.objects.filter(code__in=points).only('id', 'code'))
            for location in rows:
                lat, lng = points[location.code]
                location.latitude, location.longitude = lat, lng
                location.centroid_source = CENTROID_SOURCE
                updated += 1
            Location.objects.bulk_update(
                rows, ['latitude', 'longitude', 'centroid_source'], batch_size=500
            )
        missing = Location.objects.filter(latitude__isnull=True).count()
        self.stdout.write(
            self.style.SUCCESS(f'Updated {updated} locations; {missing} still without centroid.')
        )
