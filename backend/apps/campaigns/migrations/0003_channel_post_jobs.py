"""A channel is a place to post, not tied to one job.

The single ``job`` link target becomes the list of jobs the channel's post
advertises. A channel that pointed at one job keeps advertising that job with a
per-job link; its old ``/r/<code>`` link now opens the campaign landing page,
which still lists the job and keeps the click credited to the channel.
"""

from django.db import migrations, models


def copy_job_into_jobs(apps, schema_editor):
    CampaignChannel = apps.get_model('campaigns', 'CampaignChannel')
    for channel in CampaignChannel.objects.exclude(job__isnull=True):
        channel.jobs.add(channel.job_id)


def copy_first_job_back(apps, schema_editor):
    CampaignChannel = apps.get_model('campaigns', 'CampaignChannel')
    for channel in CampaignChannel.objects.filter(target='job'):
        first = channel.jobs.order_by('pk').first()
        if first is None:
            channel.target = 'landing'
        channel.job = first
        channel.save(update_fields=['job', 'target'])
    CampaignChannel.objects.filter(target='company').update(target='landing')


class Migration(migrations.Migration):
    dependencies = [
        ('campaigns', '0002_initial'),
        ('jobs', '0001_initial'),
    ]

    operations = [
        migrations.RemoveConstraint(model_name='campaignchannel', name='camp_channel_job_target'),
        migrations.AlterField(
            model_name='campaignchannel',
            name='job',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=models.SET_NULL,
                related_name='+',
                to='jobs.job',
            ),
        ),
        migrations.AddField(
            model_name='campaignchannel',
            name='jobs',
            field=models.ManyToManyField(
                blank=True, related_name='campaign_channels', to='jobs.job'
            ),
        ),
        migrations.RunPython(copy_job_into_jobs, copy_first_job_back),
        migrations.RemoveField(model_name='campaignchannel', name='job'),
        migrations.AlterField(
            model_name='campaignchannel',
            name='target',
            field=models.CharField(
                choices=[
                    ('landing', 'Trang tuyển dụng của chiến dịch'),
                    ('job', 'Link riêng từng tin'),
                    ('company', 'Trang công ty'),
                ],
                default='landing',
                max_length=10,
            ),
        ),
    ]
