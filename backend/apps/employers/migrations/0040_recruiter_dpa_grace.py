from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('employers', '0039_employer_dpa_acceptance')]

    operations = [
        migrations.AddField(
            model_name='recruiterprofile',
            name='dpa_grace_started_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='recruiterprofile',
            name='dpa_grace_expires_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='recruiterprofile',
            name='dpa_grace_rollout_id',
            field=models.CharField(blank=True, max_length=64),
        ),
        migrations.AddConstraint(
            model_name='recruiterprofile',
            constraint=models.CheckConstraint(
                condition=(
                    models.Q(
                        dpa_grace_started_at__isnull=True,
                        dpa_grace_expires_at__isnull=True,
                        dpa_grace_rollout_id='',
                    )
                    | (
                        models.Q(
                            dpa_grace_started_at__isnull=False,
                            dpa_grace_expires_at__isnull=False,
                        )
                        & ~models.Q(dpa_grace_rollout_id='')
                        & models.Q(dpa_grace_expires_at__gt=models.F('dpa_grace_started_at'))
                    )
                ),
                name='employer_dpa_grace_state_consistent',
            ),
        ),
    ]
