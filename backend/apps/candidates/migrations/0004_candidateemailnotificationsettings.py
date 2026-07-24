import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('candidates', '0003_candidateconsentevent'),
    ]

    operations = [
        migrations.CreateModel(
            name='CandidateEmailNotificationSettings',
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
                ('important_system_updates', models.BooleanField(default=False)),
                ('employer_viewed_cv', models.BooleanField(default=False)),
                ('new_features_and_cv_templates', models.BooleanField(default=False)),
                ('other_system_notifications', models.BooleanField(default=False)),
                ('configured_job_alerts', models.BooleanField(default=False)),
                ('suitable_job_recommendations', models.BooleanField(default=False)),
                ('top_candidate_alerts', models.BooleanField(default=False)),
                ('employer_invitations', models.BooleanField(default=False)),
                ('job_and_career_events', models.BooleanField(default=False)),
                ('service_introductions', models.BooleanField(default=False)),
                ('program_and_event_introductions', models.BooleanField(default=False)),
                ('partner_gifts_and_discounts', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                (
                    'candidate_profile',
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='email_notification_settings',
                        to='candidates.candidateprofile',
                    ),
                ),
            ],
            options={
                'db_table': 'candidate_email_notification_settings',
            },
        ),
    ]
