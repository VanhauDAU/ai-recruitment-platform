from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('candidates', '0004_candidateemailnotificationsettings'),
    ]

    operations = [
        migrations.AlterField(
            model_name='candidateemailnotificationsettings',
            name='important_system_updates',
            field=models.BooleanField(default=True),
        ),
        migrations.AlterField(
            model_name='candidateemailnotificationsettings',
            name='employer_viewed_cv',
            field=models.BooleanField(default=True),
        ),
        migrations.AlterField(
            model_name='candidateemailnotificationsettings',
            name='new_features_and_cv_templates',
            field=models.BooleanField(default=True),
        ),
        migrations.AlterField(
            model_name='candidateemailnotificationsettings',
            name='other_system_notifications',
            field=models.BooleanField(default=True),
        ),
        migrations.AlterField(
            model_name='candidateemailnotificationsettings',
            name='configured_job_alerts',
            field=models.BooleanField(default=True),
        ),
        migrations.AlterField(
            model_name='candidateemailnotificationsettings',
            name='suitable_job_recommendations',
            field=models.BooleanField(default=True),
        ),
        migrations.AlterField(
            model_name='candidateemailnotificationsettings',
            name='top_candidate_alerts',
            field=models.BooleanField(default=True),
        ),
        migrations.AlterField(
            model_name='candidateemailnotificationsettings',
            name='employer_invitations',
            field=models.BooleanField(default=True),
        ),
        migrations.AlterField(
            model_name='candidateemailnotificationsettings',
            name='job_and_career_events',
            field=models.BooleanField(default=True),
        ),
        migrations.AlterField(
            model_name='candidateemailnotificationsettings',
            name='service_introductions',
            field=models.BooleanField(default=True),
        ),
        migrations.AlterField(
            model_name='candidateemailnotificationsettings',
            name='program_and_event_introductions',
            field=models.BooleanField(default=True),
        ),
        migrations.AlterField(
            model_name='candidateemailnotificationsettings',
            name='partner_gifts_and_discounts',
            field=models.BooleanField(default=True),
        ),
    ]
