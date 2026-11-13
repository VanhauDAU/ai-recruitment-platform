from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('jobs', '0047_remove_job_approval_states')]

    operations = [
        migrations.AddField(
            model_name='job',
            name='responsibility_accepted_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='job',
            name='responsibility_statement_version',
            field=models.CharField(blank=True, default='', max_length=20),
        ),
    ]
