"""Contract: make the snapshot FK mandatory and index it.

Runs only after 0005 has committed a snapshot for every application. A guard
first asserts there are no remaining NULLs so the ALTER never fails halfway and
so a misconfigured database fails loudly instead of silently dropping the
constraint. This is the final step of expand -> backfill -> contract.
"""

from django.db import migrations, models
import django.db.models.deletion


def assert_backfill_complete(apps, schema_editor):
    Application = apps.get_model('applications', 'Application')
    missing = Application.objects.filter(submitted_cv_version__isnull=True).count()
    if missing:
        raise RuntimeError(
            f'Cannot enforce Application.submitted_cv_version NOT NULL: '
            f'{missing} application(s) still lack a snapshot. Re-run migration '
            f'applications.0005_application_snapshot_backfill first.'
        )


class Migration(migrations.Migration):

    dependencies = [
        ('applications', '0005_application_snapshot_backfill'),
    ]

    operations = [
        migrations.RunPython(assert_backfill_complete, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='application',
            name='submitted_cv_version',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.PROTECT,
                related_name='submitted_applications',
                to='cvs.cvversion',
            ),
        ),
        migrations.AddIndex(
            model_name='application',
            index=models.Index(fields=['submitted_cv_version'], name='idx_app_submitted_cv_version'),
        ),
    ]
