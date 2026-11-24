from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('jobs', '0003_job_code')]

    operations = [
        migrations.AlterField(
            model_name='job',
            name='code',
            field=models.CharField(editable=False, max_length=8, unique=True),
        ),
        migrations.AddConstraint(
            model_name='job',
            constraint=models.CheckConstraint(
                condition=models.Q(('code__regex', '^J[1-9][0-9]{6}$')),
                name='chk_jobs_code_format',
            ),
        ),
    ]
