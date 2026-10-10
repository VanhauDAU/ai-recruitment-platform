import apps.jobs.models.core
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('jobs', '0042_backfill_job_lifecycle_v2'),
    ]

    operations = [
        migrations.AddField(
            model_name='job',
            name='application_reasons',
            field=models.JSONField(
                blank=True,
                default=list,
                help_text='Tối đa ba lý do có thứ tự để ứng viên cân nhắc ứng tuyển.',
                validators=[apps.jobs.models.core.validate_application_reasons],
            ),
        ),
    ]
