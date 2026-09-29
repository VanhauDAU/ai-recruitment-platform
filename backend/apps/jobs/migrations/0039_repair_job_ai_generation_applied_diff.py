"""Repair databases that applied jobs.0038 before ``applied_diff`` was added.

The final 0038 state already owns the field, so this migration intentionally
contains database operations only. ``IF NOT EXISTS`` keeps fresh databases,
where 0038 creates the column, on the same forward-only migration path.
"""

from django.db import migrations

ADD_APPLIED_DIFF_SQL = """
ALTER TABLE "jobs_jobaigeneration"
    ADD COLUMN IF NOT EXISTS "applied_diff" jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE "jobs_jobaigeneration"
    ALTER COLUMN "applied_diff" DROP DEFAULT;
"""


class Migration(migrations.Migration):
    dependencies = [
        ('jobs', '0038_jobaigeneration'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    sql=ADD_APPLIED_DIFF_SQL,
                    # 0038 owns this field in Django's state. Reversing this
                    # repair must not remove a column expected by that state.
                    reverse_sql=migrations.RunSQL.noop,
                ),
            ],
            state_operations=[],
        ),
    ]
