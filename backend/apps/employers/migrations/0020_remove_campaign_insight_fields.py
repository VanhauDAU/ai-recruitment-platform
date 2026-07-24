from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ('employers', '0019_campaign_insight_and_activity'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='recruitmentcampaign',
            name='desired_locations',
        ),
        migrations.RemoveField(
            model_name='recruitmentcampaign',
            name='experience_years',
        ),
        migrations.RemoveField(
            model_name='recruitmentcampaign',
            name='salary_currency',
        ),
        migrations.RemoveField(
            model_name='recruitmentcampaign',
            name='salary_max',
        ),
        migrations.RemoveField(
            model_name='recruitmentcampaign',
            name='salary_min',
        ),
        migrations.RemoveField(
            model_name='recruitmentcampaign',
            name='salary_type',
        ),
    ]
