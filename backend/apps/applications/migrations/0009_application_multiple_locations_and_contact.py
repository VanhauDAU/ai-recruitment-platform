from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('applications', '0008_application_preferences_and_consent'),
        ('locations', '0002_location_merged_from'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='application',
            name='preferred_location',
        ),
        migrations.AddField(
            model_name='application',
            name='preferred_locations',
            field=models.ManyToManyField(
                blank=True,
                related_name='applications',
                to='locations.location',
            ),
        ),
        migrations.AddField(
            model_name='application',
            name='contact_name',
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name='application',
            name='contact_email',
            field=models.EmailField(blank=True, max_length=254),
        ),
        migrations.AddField(
            model_name='application',
            name='contact_phone',
            field=models.CharField(blank=True, max_length=20),
        ),
    ]
