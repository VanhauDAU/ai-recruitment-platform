from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('jobs', '0044_job_report_trust_evidence'),
    ]

    operations = [
        migrations.CreateModel(
            name='CandidateHiddenJob',
            fields=[
                (
                    'id',
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name='ID',
                    ),
                ),
                (
                    'source',
                    models.CharField(
                        choices=[
                            ('matching', 'Việc làm phù hợp'),
                            ('homepage', 'Trang chủ'),
                            ('inline', 'Danh sách việc làm'),
                        ],
                        max_length=20,
                    ),
                ),
                ('hidden_at', models.DateTimeField(auto_now_add=True)),
                (
                    'candidate',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='hidden_recommended_jobs',
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    'job',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='hidden_by_candidates',
                        to='jobs.job',
                    ),
                ),
            ],
            options={
                'db_table': 'candidate_hidden_jobs',
                'ordering': ['-hidden_at', '-pk'],
                'indexes': [
                    models.Index(
                        fields=['candidate', '-hidden_at'],
                        name='jobs_hidden_candidate_idx',
                    )
                ],
                'constraints': [
                    models.UniqueConstraint(
                        fields=('candidate', 'job'),
                        name='uq_candidate_hidden_job',
                    )
                ],
            },
        ),
    ]
