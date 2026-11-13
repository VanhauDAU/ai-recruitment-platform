from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ('employers', '0043_employer_notification_preferences_and_outbox_dedupe'),
    ]

    operations = [
        migrations.RemoveConstraint(
            model_name='company',
            name='uniq_verified_company_tax_code',
        ),
        # Keep the legacy columns physically for one rolling-deploy window so
        # old workers can still read them while new workers omit them. Defaults
        # allow inserts from the new model. A later contract migration may drop
        # the columns after all old workers have drained.
        migrations.RunSQL(
            sql=(
                "ALTER TABLE employers_company "
                "ALTER COLUMN verification_status SET DEFAULT 'unverified', "
                "ALTER COLUMN verification_source SET DEFAULT '', "
                "ALTER COLUMN rejected_reason SET DEFAULT ''"
            ),
            reverse_sql=(
                'ALTER TABLE employers_company '
                'ALTER COLUMN verification_status DROP DEFAULT, '
                'ALTER COLUMN verification_source DROP DEFAULT, '
                'ALTER COLUMN rejected_reason DROP DEFAULT'
            ),
        ),
        migrations.SeparateDatabaseAndState(
            database_operations=[],
            state_operations=[
                migrations.RemoveField(
                    model_name='company',
                    name='verification_source',
                ),
                migrations.RemoveField(
                    model_name='company',
                    name='verification_status',
                ),
                migrations.RemoveField(
                    model_name='company',
                    name='verified_at',
                ),
                migrations.RemoveField(
                    model_name='company',
                    name='rejected_reason',
                ),
            ],
        ),
    ]
