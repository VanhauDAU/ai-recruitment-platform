"""Expand: add the nullable application-snapshot columns.

Split from the original monolithic snapshot migration. Keeping the additive
schema change in its own migration guarantees the FK column and its deferred
constraint are committed before any row is written or any NOT NULL is enforced,
which is what avoids PostgreSQL's "cannot ALTER TABLE ... because it has pending
trigger events" error on databases that already hold legacy applications.

See 0005 (backfill) and 0006 (contract) for the rest of the expand/backfill/
contract sequence.
"""

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('applications', '0003_initial'),
        ('cvs', '0002_architecture_foundation'),
    ]

    operations = [
        migrations.AddField(
            model_name='application',
            name='submitted_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='application',
            name='submitted_cv_source',
            field=models.CharField(default='builder', max_length=30),
        ),
        migrations.AddField(
            model_name='application',
            name='submitted_cv_title',
            field=models.CharField(default='', max_length=255),
        ),
        migrations.AddField(
            model_name='application',
            name='submitted_cv_version',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name='submitted_applications',
                to='cvs.cvversion',
            ),
        ),
    ]
