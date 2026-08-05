"""Keep Docker volumes created by an older 0024 migration insert-compatible.

Those databases still have two retired NOT NULL address columns. Fresh databases
do not, so each schema-only alteration is guarded by an existence check.
"""

from django.db import migrations

LEGACY_ADDRESS_DEFAULTS_SQL = """
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'employers_companytaxlookupevidence'
          AND column_name = 'submitted_registered_address'
    ) THEN
        ALTER TABLE employers_companytaxlookupevidence
            ALTER COLUMN submitted_registered_address SET DEFAULT '';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'employers_companytaxlookupevidence'
          AND column_name = 'registered_address'
    ) THEN
        ALTER TABLE employers_companytaxlookupevidence
            ALTER COLUMN registered_address SET DEFAULT '';
    END IF;
END
$$;
"""


class Migration(migrations.Migration):
    dependencies = [
        ('employers', '0026_allow_multiple_current_verification_documents'),
    ]

    operations = [
        migrations.RunSQL(
            LEGACY_ADDRESS_DEFAULTS_SQL,
            reverse_sql=migrations.RunSQL.noop,
        ),
    ]
