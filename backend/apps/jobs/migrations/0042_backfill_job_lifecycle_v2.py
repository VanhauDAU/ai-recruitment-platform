from django.db import migrations


BACKFILL_LIFECYCLE_SQL = """
UPDATE jobs_job AS job
SET first_approved_at = COALESCE(
    (
        SELECT MIN(history.created_at)
        FROM jobs_jobstatushistory AS history
        WHERE history.job_id = job.id
          AND history.to_status = 'active'
    ),
    job.published_at,
    job.approved_at
)
WHERE job.first_approved_at IS NULL;

UPDATE jobs_job
SET visibility_starts_at = first_approved_at
WHERE visibility_starts_at IS NULL
  AND first_approved_at IS NOT NULL;

UPDATE jobs_job
SET visibility_ends_at = CASE
    WHEN deadline IS NOT NULL THEN
        ((deadline + 1)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')
    ELSE visibility_starts_at + INTERVAL '30 days'
END
WHERE visibility_ends_at IS NULL
  AND visibility_starts_at IS NOT NULL;

UPDATE jobs_job
SET requested_visibility_days = LEAST(
    90,
    GREATEST(
        1,
        CEIL(EXTRACT(EPOCH FROM (visibility_ends_at - visibility_starts_at)) / 86400.0)::integer
    )
)
WHERE visibility_starts_at IS NOT NULL
  AND visibility_ends_at IS NOT NULL;
"""


class Migration(migrations.Migration):
    atomic = False

    dependencies = [
        ('jobs', '0041_job_lifecycle_v2_foundation'),
    ]

    operations = [
        migrations.RunSQL(
            sql=BACKFILL_LIFECYCLE_SQL,
            reverse_sql=migrations.RunSQL.noop,
        ),
    ]
