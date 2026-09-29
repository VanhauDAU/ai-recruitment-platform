from django.contrib.postgres.operations import AddIndexConcurrently, RemoveIndexConcurrently
from django.db import migrations, models


class Migration(migrations.Migration):
    atomic = False

    dependencies = [
        ('services', '0010_repair_quantity_activation_windows'),
    ]

    operations = [
        AddIndexConcurrently(
            model_name='jobserviceusageevent',
            index=models.Index(
                fields=['job', 'event_type', '-occurred_at', '-id'],
                name='services_usage_job_rank_idx',
            ),
        ),
        RemoveIndexConcurrently(
            model_name='jobserviceusageevent',
            name='services_usage_job_idx',
        ),
    ]
