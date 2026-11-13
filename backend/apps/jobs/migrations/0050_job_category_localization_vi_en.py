"""CVT-1a: taxonomy vị trí chỉ còn tiếng Việt/Anh, bỏ FK tới sitecontent.Locale."""

from django.db import migrations, models

SUPPORTED = ('vi-VN', 'en-US')


def delete_unsupported_localizations(apps, schema_editor):
    JobCategoryLocalization = apps.get_model('jobs', 'JobCategoryLocalization')
    JobCategoryLocalization.objects.exclude(locale__in=SUPPORTED).delete()


class Migration(migrations.Migration):
    dependencies = [
        ('jobs', '0049_forget_services_app'),
    ]

    operations = [
        migrations.RunPython(delete_unsupported_localizations, migrations.RunPython.noop),
        migrations.RemoveField(model_name='jobcategorylocalization', name='locale_ref'),
        migrations.AlterField(
            model_name='jobcategorylocalization',
            name='locale',
            field=models.CharField(
                choices=[('vi-VN', 'Tiếng Việt'), ('en-US', 'Tiếng Anh')], max_length=16
            ),
        ),
    ]
