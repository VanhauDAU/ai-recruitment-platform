from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [('jobs', '0027_job_engagement_tracking')]

    operations = [
        migrations.RemoveConstraint(
            model_name='job',
            name='jobs_one_job_per_campaign',
        ),
    ]
