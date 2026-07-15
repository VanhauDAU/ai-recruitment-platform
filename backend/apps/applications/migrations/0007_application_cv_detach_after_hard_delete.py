# Generated manually for the permanent candidate-CV deletion policy.

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ('applications', '0006_application_snapshot_contract'),
        ('cvs', '0009_cvversion_detach_after_hard_delete'),
    ]

    operations = [
        migrations.AlterField(
            model_name='application',
            name='cv',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='applications',
                to='cvs.usercv',
            ),
        ),
    ]
