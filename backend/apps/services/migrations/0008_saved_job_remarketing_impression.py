import django.db.models.deletion
import django.utils.timezone
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('jobs', '0043_job_application_reasons'),
        ('services', '0007_retire_legacy_service_catalog'),
    ]

    operations = [
        migrations.CreateModel(
            name='SavedJobRemarketingImpression',
            fields=[
                (
                    'id',
                    models.BigAutoField(
                        auto_created=True, primary_key=True, serialize=False, verbose_name='ID'
                    ),
                ),
                ('shown_on', models.DateField()),
                ('shown_at', models.DateTimeField(default=django.utils.timezone.now)),
                (
                    'activation',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name='saved_remarketing_impressions',
                        to='services.jobserviceactivation',
                    ),
                ),
                (
                    'candidate',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='saved_job_remarketing_impressions',
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    'job',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='saved_remarketing_impressions',
                        to='jobs.job',
                    ),
                ),
            ],
            options={
                'verbose_name': 'Lượt hiển thị lại tin đã lưu',
                'verbose_name_plural': 'Lượt hiển thị lại tin đã lưu',
                'ordering': ['-shown_at', '-id'],
                'indexes': [
                    models.Index(fields=['candidate', 'shown_at'], name='svc_saved_rem_cand_idx'),
                    models.Index(fields=['activation', 'shown_at'], name='svc_saved_rem_act_idx'),
                ],
                'constraints': [
                    models.UniqueConstraint(
                        fields=('candidate', 'job', 'shown_on'),
                        name='services_saved_rem_once_per_day',
                    ),
                ],
            },
        ),
    ]
