from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('applications', '0007_application_cv_detach_after_hard_delete'),
        ('locations', '0002_location_merged_from'),
    ]

    operations = [
        migrations.AddField(
            model_name='application',
            name='allow_ai_analysis',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='application',
            name='data_processing_consent',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='application',
            name='preferred_location',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='applications',
                to='locations.location',
            ),
        ),
    ]
