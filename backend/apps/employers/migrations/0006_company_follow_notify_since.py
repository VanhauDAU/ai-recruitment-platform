import django.utils.timezone
from django.db import migrations, models


def backfill_notify_since(apps, schema_editor):
    # Existing follows have never been muted and unmuted through this field,
    # so their email window still starts at the follow itself.
    CompanyFollow = apps.get_model('employers', 'CompanyFollow')
    CompanyFollow.objects.update(notify_since=models.F('created_at'))


class Migration(migrations.Migration):
    dependencies = [
        ('employers', '0005_social_connection_expiring'),
    ]

    operations = [
        migrations.AddField(
            model_name='companyfollow',
            name='notify_since',
            field=models.DateTimeField(default=django.utils.timezone.now),
        ),
        migrations.RunPython(backfill_notify_since, migrations.RunPython.noop),
    ]
