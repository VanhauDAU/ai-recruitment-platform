import json
import urllib.request

from django.core.management.base import BaseCommand
from django.db import transaction

from locations.models import Location

API_BASE = 'https://provinces.open-api.vn/api/v2'


def fetch_json(url):
    with urllib.request.urlopen(url, timeout=15) as response:
        return json.loads(response.read().decode('utf-8'))


class Command(BaseCommand):
    help = (
        'One-time/periodic import of Vietnam 2-tier administrative data '
        '(34 provinces + ~3,321 wards) from provinces.open-api.vn into the '
        'locations table. Not called in the live request path — run manually '
        'at setup and again whenever administrative boundaries change.'
    )

    def handle(self, *args, **options):
        self.stdout.write('Fetching province list...')
        provinces = fetch_json(f'{API_BASE}/p/')

        province_count, ward_count = 0, 0
        with transaction.atomic():
            for province in provinces:
                province_obj, _ = Location.objects.update_or_create(
                    code=str(province['code']),
                    defaults={
                        'level': Location.Level.PROVINCE,
                        'name': province['name'],
                        'province_type': province.get('division_type', ''),
                        'parent': None,
                        'is_active': True,
                    },
                )
                province_count += 1

                detail = fetch_json(f"{API_BASE}/p/{province['code']}?depth=2")
                for ward in detail.get('wards', []):
                    Location.objects.update_or_create(
                        code=str(ward['code']),
                        defaults={
                            'level': Location.Level.WARD,
                            'name': ward['name'],
                            'ward_type': ward.get('division_type', ''),
                            'parent': province_obj,
                            'is_active': True,
                        },
                    )
                    ward_count += 1
                self.stdout.write(f"  {province['name']}: {len(detail.get('wards', []))} wards")

        self.stdout.write(self.style.SUCCESS(f'Seeded {province_count} provinces and {ward_count} wards.'))
