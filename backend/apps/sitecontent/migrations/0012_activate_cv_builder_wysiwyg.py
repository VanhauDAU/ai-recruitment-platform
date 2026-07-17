from django.db import migrations


def activate_cv_builder(apps, schema_editor):
    SiteSetting = apps.get_model('sitecontent', 'SiteSetting')
    SiteSetting.objects.filter(key='cv_builder_wysiwyg_enabled').update(
        value=True,
        description='Editor CV mặc định; tắt để rollback tạm thời về editor form cũ.',
    )


def deactivate_cv_builder(apps, schema_editor):
    SiteSetting = apps.get_model('sitecontent', 'SiteSetting')
    SiteSetting.objects.filter(key='cv_builder_wysiwyg_enabled').update(value=False)


class Migration(migrations.Migration):
    dependencies = [('sitecontent', '0011_cv_builder_wysiwyg_flag')]

    operations = [migrations.RunPython(activate_cv_builder, deactivate_cv_builder)]
