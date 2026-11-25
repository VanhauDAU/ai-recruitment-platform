"""Gán tọa độ cho nơi làm việc có từ trước ADR-0029 (chưa từng được xử lý).

Cùng quy tắc với `services.coordinates.assign_coordinates` nhưng không gọi cache
geocode: dòng có địa chỉ chi tiết được đánh dấu chờ, tác vụ định kỳ
`geocode_pending_job_locations` geocode dần. Ghim của NTD không bị đụng tới.
"""

from django.db import migrations


def backfill(apps, schema_editor):
    JobLocation = apps.get_model('jobs', 'JobLocation')
    rows = list(
        JobLocation.objects.filter(coordinate_precision='').select_related('location')
    )
    for row in rows:
        location = row.location
        has_centroid = location.level == 'ward' and location.latitude is not None
        row.latitude = location.latitude if has_centroid else None
        row.longitude = location.longitude if has_centroid else None
        row.coordinate_precision = 'ward' if has_centroid else 'province'
        row.coordinate_source = 'ward_centroid' if has_centroid else ''
        row.geocode_pending = location.level == 'ward' and bool(row.address_detail.strip())
    JobLocation.objects.bulk_update(
        rows,
        ['latitude', 'longitude', 'coordinate_precision', 'coordinate_source', 'geocode_pending'],
        batch_size=500,
    )


class Migration(migrations.Migration):
    dependencies = [
        ('jobs', '0006_workplace_coordinates'),
        ('locations', '0003_load_centroids'),
    ]

    operations = [migrations.RunPython(backfill, migrations.RunPython.noop)]
