from django.db import migrations


def seed_cv_builder_flag(apps, schema_editor):
    SiteSetting = apps.get_model('sitecontent', 'SiteSetting')
    SiteSetting.objects.get_or_create(
        key='cv_builder_wysiwyg_enabled',
        defaults={
            'label': 'Bật trình chỉnh sửa CV WYSIWYG',
            'group': 'cv',
            'value': False,
            'value_type': 'boolean',
            'options': {},
            'order': 20,
            'description': 'Bật theo rollout; tắt để dùng editor form cũ.',
            'is_public': True,
        },
    )


class Migration(migrations.Migration):
    dependencies = [('sitecontent', '0010_locale')]

    operations = [migrations.RunPython(seed_cv_builder_flag, migrations.RunPython.noop)]
