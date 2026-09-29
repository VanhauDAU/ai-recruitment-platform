from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('jobs', '0039_repair_job_ai_generation_applied_diff'),
    ]

    operations = [
        migrations.AddIndex(
            model_name='job',
            index=models.Index(
                fields=['status', '-created_at', '-id'],
                name='jobs_status_created_desc_idx',
            ),
        ),
    ]
