"""Social connections name their network instead of a provider (ADR-0025).

``provider`` mixed two things: the network (only Facebook so far) and whether
the connection came from the fake provider. It becomes ``network`` plus
``simulated``. 0005 copies the data and 0006 drops ``provider`` and renames the
Page-only columns. Each step is its own migration because PostgreSQL refuses to
ALTER a table that has pending trigger events from rows updated in the same
transaction, in either direction.
"""

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('campaigns', '0003_channel_post_jobs'),
    ]

    operations = [
        migrations.RemoveConstraint(
            model_name='socialaccountconnection',
            name='camp_social_page_unique',
        ),
        migrations.AddField(
            model_name='socialaccountconnection',
            name='network',
            field=models.CharField(
                choices=[('facebook_page', 'Fanpage Facebook')],
                default='facebook_page',
                max_length=20,
            ),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name='socialaccountconnection',
            name='simulated',
            field=models.BooleanField(default=False),
        ),
    ]
