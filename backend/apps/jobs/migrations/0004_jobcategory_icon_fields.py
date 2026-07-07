from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('jobs', '0003_remove_job_jobs_job_locatio_11d7ca_idx_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='jobcategory',
            name='icon_key',
            field=models.CharField(
                blank=True,
                help_text='Frontend icon key, e.g. sales, marketing, support, hr, it, bank.',
                max_length=80,
            ),
        ),
        migrations.AddField(
            model_name='jobcategory',
            name='icon_color',
            field=models.CharField(
                blank=True,
                help_text='Optional CSS color for the category icon, e.g. #00b14f.',
                max_length=32,
            ),
        ),
    ]
