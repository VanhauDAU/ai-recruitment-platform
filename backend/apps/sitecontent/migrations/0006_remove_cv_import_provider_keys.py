"""Import CV dùng chung runtime AI (AI_PROVIDER_BACKEND, AI_CV_IMPORT_MODEL).

Hai key chọn nhà cung cấp/model riêng cho import CV không còn code đọc (ADR-0026).
"""

from django.db import migrations

REMOVED_KEYS = ('ai_provider', 'ai_model')


def forwards(apps, schema_editor):
    apps.get_model('sitecontent', 'SiteSetting').objects.filter(key__in=REMOVED_KEYS).delete()


class Migration(migrations.Migration):
    dependencies = [('sitecontent', '0005_setting_multiselect_type')]

    operations = [migrations.RunPython(forwards, migrations.RunPython.noop)]
