"""Remove retired address fields left behind in older Docker database volumes."""

from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ('employers', '0027_legacy_tax_lookup_address_defaults'),
    ]

    operations = [
        migrations.RunSQL(
            """
            ALTER TABLE employers_companytaxlookupevidence
                DROP COLUMN IF EXISTS submitted_registered_address,
                DROP COLUMN IF EXISTS registered_address;
            """,
            reverse_sql=migrations.RunSQL.noop,
        ),
    ]
