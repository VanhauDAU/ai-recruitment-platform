"""Fill missing visibility windows now that the window always applies.

0042 backfilled the window while it was still optional; a job that went live
without one since would silently disappear once the window is enforced. Only
rows whose anchors are still NULL are touched, so re-running is harmless.
"""

from django.db import migrations

BACKFILL_MISSING_WINDOW_SQL = """
UPDATE jobs_job
SET first_approved_at = COALESCE(published_at, approved_at, created_at)
WHERE first_approved_at IS NULL
  AND status IN ('active', 'closed');

UPDATE jobs_job
SET visibility_starts_at = first_approved_at
WHERE visibility_starts_at IS NULL
  AND first_approved_at IS NOT NULL
  AND status IN ('active', 'closed');

UPDATE jobs_job
SET visibility_ends_at = visibility_starts_at + make_interval(days => requested_visibility_days)
WHERE visibility_ends_at IS NULL
  AND visibility_starts_at IS NOT NULL;
"""


class Migration(migrations.Migration):
    dependencies = [
        ('jobs', '0051_followed_company_digest_source'),
    ]

    operations = [
        migrations.RunSQL(sql=BACKFILL_MISSING_WINDOW_SQL, reverse_sql=migrations.RunSQL.noop),
    ]
