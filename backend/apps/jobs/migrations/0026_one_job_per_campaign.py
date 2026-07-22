from django.db import migrations, models


def keep_latest_campaign_job(apps, schema_editor):
    """Detach legacy duplicate jobs without deleting any job record."""
    Job = apps.get_model('jobs', 'Job')
    campaign_ids = (
        Job.objects.exclude(campaign_id=None)
        .values_list('campaign_id', flat=True)
        .distinct()
    )
    for campaign_id in campaign_ids.iterator():
        job_ids = list(
            Job.objects.filter(campaign_id=campaign_id)
            .order_by('-created_at', '-pk')
            .values_list('pk', flat=True)
        )
        if len(job_ids) > 1:
            Job.objects.filter(pk__in=job_ids[1:]).update(campaign_id=None)


class Migration(migrations.Migration):

    dependencies = [('jobs', '0025_job_work_types_benefit_category')]

    operations = [
        migrations.RunPython(keep_latest_campaign_job, migrations.RunPython.noop),
        migrations.AddConstraint(
            model_name='job',
            constraint=models.UniqueConstraint(
                condition=models.Q(('campaign__isnull', False)),
                fields=('campaign',),
                name='jobs_one_job_per_campaign',
            ),
        ),
    ]
