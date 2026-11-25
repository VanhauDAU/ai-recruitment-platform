"""Thời gian hoàn tác quyết định đổi sang giây (mặc định 15 giây).

Key cũ tính bằng phút không còn code đọc; seed tạo key mới
``candidate_status_notify_delay_seconds`` với giá trị mặc định.
"""

from django.db import migrations

REMOVED_KEYS = ('candidate_status_notify_delay_minutes',)


def forwards(apps, schema_editor):
    apps.get_model('sitecontent', 'SiteSetting').objects.filter(key__in=REMOVED_KEYS).delete()


class Migration(migrations.Migration):
    dependencies = [('sitecontent', '0008_banner_more_themes')]

    operations = [migrations.RunPython(forwards, migrations.RunPython.noop)]
