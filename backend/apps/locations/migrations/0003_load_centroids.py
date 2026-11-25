"""Nạp tâm phường/tỉnh từ seed_data/centroids.json ngay khi migrate (ADR-0029).

Trước đây phải chạy tay `seed_location_coordinates`; môi trường chỉ tự migrate (Docker,
deploy) thì thiếu bước đó và "Việc làm gần tôi" không tìm được gì. Chỉ điền chỗ còn
trống, không ghi đè tâm đã có; DB chưa seed địa điểm thì không làm gì.
"""

import json
from pathlib import Path

from django.db import migrations

CENTROIDS = Path(__file__).resolve().parents[1] / 'seed_data' / 'centroids.json'


def load_centroids(apps, schema_editor):
    Location = apps.get_model('locations', 'Location')
    points = json.loads(CENTROIDS.read_text(encoding='utf-8'))['locations']
    rows = list(
        Location.objects.filter(code__in=points, latitude__isnull=True).only('id', 'code')
    )
    for row in rows:
        row.latitude, row.longitude = points[row.code]
        row.centroid_source = 'boundary'
    Location.objects.bulk_update(rows, ['latitude', 'longitude', 'centroid_source'], batch_size=500)


class Migration(migrations.Migration):
    dependencies = [('locations', '0002_coordinates')]

    operations = [migrations.RunPython(load_centroids, migrations.RunPython.noop)]
