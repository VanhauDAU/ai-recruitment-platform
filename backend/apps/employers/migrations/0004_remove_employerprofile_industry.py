from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ('employers', '0003_backfill_industries'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='employerprofile',
            name='industry',
        ),
    ]
