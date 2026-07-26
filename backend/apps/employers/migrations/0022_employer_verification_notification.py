import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('employers', '0021_employer_account_verification'),
    ]

    operations = [
        migrations.CreateModel(
            name='EmployerVerificationNotification',
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
                ('event_type', models.CharField(max_length=32)),
                (
                    'status',
                    models.CharField(
                        choices=[
                            ('pending', 'Chờ gửi'),
                            ('sending', 'Đang gửi'),
                            ('sent', 'Đã gửi'),
                            ('failed', 'Gửi thất bại'),
                        ],
                        default='pending',
                        max_length=20,
                    ),
                ),
                ('attempts', models.PositiveSmallIntegerField(default=0)),
                ('context', models.JSONField(blank=True, default=dict)),
                ('last_error', models.TextField(blank=True)),
                ('started_at', models.DateTimeField(blank=True, null=True)),
                ('sent_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                (
                    'recipient',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='+',
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    'verification_case',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='notification_jobs',
                        to='employers.employerverificationcase',
                    ),
                ),
            ],
            options={
                'indexes': [
                    models.Index(
                        fields=['status', 'created_at'],
                        name='emp_verify_notice_queue_idx',
                    )
                ],
            },
        ),
    ]
