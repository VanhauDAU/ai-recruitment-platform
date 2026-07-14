"""Expand: add the nullable application-snapshot columns.

Split from the original monolithic snapshot migration. Keeping the additive
schema change in its own migration guarantees the FK column and its deferred
constraint are committed before any row is written or any NOT NULL is enforced,
which is what avoids PostgreSQL's "cannot ALTER TABLE ... because it has pending
trigger events" error on databases that already hold legacy applications.

The DDL is wrapped in SeparateDatabaseAndState so it can recover a database that
partially applied the original monolithic migration: the columns may already
exist even though the migration was never recorded. The database side adds them
only when missing (guarded, all-or-nothing on the FK column) while the state side
stays a plain set of AddField, so `makemigrations --check` and fresh installs are
unaffected. See 0005 (backfill) and 0006 (contract) for the rest of the sequence.
"""

from django.db import migrations, models
import django.db.models.deletion


# Exactly the DDL Django emits for the four AddField operations (captured with
# `sqlmigrate`), guarded so re-running against a partial database is a no-op.
# Adding the FK column also creates its constraint + index, so the presence of
# `submitted_cv_version_id` is a reliable all-or-nothing marker.
EXPAND_SQL = """
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'applications_application'
          AND column_name = 'submitted_cv_version_id'
    ) THEN
        ALTER TABLE "applications_application" ADD COLUMN "submitted_at" timestamp with time zone NULL;
        ALTER TABLE "applications_application" ADD COLUMN "submitted_cv_source" varchar(30) DEFAULT 'builder' NOT NULL;
        ALTER TABLE "applications_application" ALTER COLUMN "submitted_cv_source" DROP DEFAULT;
        ALTER TABLE "applications_application" ADD COLUMN "submitted_cv_title" varchar(255) DEFAULT '' NOT NULL;
        ALTER TABLE "applications_application" ALTER COLUMN "submitted_cv_title" DROP DEFAULT;
        ALTER TABLE "applications_application" ADD COLUMN "submitted_cv_version_id" bigint NULL
            CONSTRAINT "applications_applica_submitted_cv_version_f06bc64e_fk_cvs_cvver"
            REFERENCES "cvs_cvversion"("id") DEFERRABLE INITIALLY DEFERRED;
        CREATE INDEX "applications_application_submitted_cv_version_id_f06bc64e"
            ON "applications_application" ("submitted_cv_version_id");
    END IF;
END $$;
"""

REVERSE_SQL = """
ALTER TABLE "applications_application" DROP COLUMN IF EXISTS "submitted_cv_version_id";
ALTER TABLE "applications_application" DROP COLUMN IF EXISTS "submitted_cv_title";
ALTER TABLE "applications_application" DROP COLUMN IF EXISTS "submitted_cv_source";
ALTER TABLE "applications_application" DROP COLUMN IF EXISTS "submitted_at";
"""


class Migration(migrations.Migration):

    dependencies = [
        ('applications', '0003_initial'),
        ('cvs', '0002_architecture_foundation'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
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
            ],
            database_operations=[
                migrations.RunSQL(sql=EXPAND_SQL, reverse_sql=REVERSE_SQL),
            ],
        ),
    ]
