import django.db.models.deletion
import django.utils.timezone
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('jobs', '0026_one_job_per_campaign')]

    operations = [
        migrations.AddField(
            model_name='job',
            name='engagement_tracking_started_at',
            field=models.DateTimeField(default=django.utils.timezone.now),
        ),
        migrations.AddField(
            model_name='job',
            name='impression_count',
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.CreateModel(
            name='JobEngagementDaily',
            fields=[
                (
                    'id',
                    models.BigAutoField(
                        auto_created=True, primary_key=True, serialize=False, verbose_name='ID'
                    ),
                ),
                ('date', models.DateField()),
                ('impression_count', models.PositiveIntegerField(default=0)),
                ('view_count', models.PositiveIntegerField(default=0)),
                (
                    'job',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='daily_engagement',
                        to='jobs.job',
                    ),
                ),
            ],
            options={'ordering': ['date']},
        ),
        migrations.AddConstraint(
            model_name='jobengagementdaily',
            constraint=models.UniqueConstraint(
                fields=('job', 'date'),
                name='jobs_unique_daily_engagement',
            ),
        ),
        migrations.AddIndex(
            model_name='jobengagementdaily',
            index=models.Index(
                fields=['job', 'date'],
                name='jobs_engagement_job_date_idx',
            ),
        ),
    ]
