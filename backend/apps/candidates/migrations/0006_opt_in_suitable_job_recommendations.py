from django.db import migrations, models


def disable_existing_recommendation_emails(apps, schema_editor):
    settings_model = apps.get_model('candidates', 'CandidateEmailNotificationSettings')
    settings_model.objects.update(suitable_job_recommendations=False)


class Migration(migrations.Migration):
    dependencies = [
        ('candidates', '0005_enable_email_notification_defaults'),
    ]

    operations = [
        migrations.AlterField(
            model_name='candidateemailnotificationsettings',
            name='suitable_job_recommendations',
            field=models.BooleanField(default=False),
        ),
        migrations.RunPython(
            disable_existing_recommendation_emails,
            migrations.RunPython.noop,
        ),
    ]
