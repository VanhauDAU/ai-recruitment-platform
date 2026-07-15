# Generated manually for the permanent candidate-CV deletion policy.

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ('cvs', '0008_cv_import_jobs'),
    ]

    operations = [
        migrations.AlterField(
            model_name='cvversion',
            name='cv',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='versions',
                to='cvs.usercv',
            ),
        ),
    ]
