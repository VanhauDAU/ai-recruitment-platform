"""Upgrade + recovery tests for the application-snapshot migrations.

Covers the failure modes the expand/backfill/contract split (applications
0004/0005/0006) must survive, all against the real PostgreSQL engine:

* clean database — fresh migrate with no legacy rows;
* legacy database — a pre-snapshot Application is backfilled and contracted
  without the "pending trigger events" error;
* partial migration — columns already exist but the migration was never
  recorded (old monolithic migration failed midway) and `migrate` recovers;
* snapshot already exists — a deterministic ``cvv-application-{pk}`` row is
  reused, never duplicated;
* repair run twice — the preflight `--repair` backfill is idempotent;
* safety guard — a mismatched deterministic snapshot is refused, not mislinked.
"""

from io import StringIO

from django.apps import apps as global_apps
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase

from apps.cvs.models import CvVersion, UserCv
from apps.employers.models import Company
from apps.jobs.models import Job

BEFORE = [('applications', '0003_initial')]
EXPAND = [('applications', '0004_application_snapshot_expand')]
AFTER = [('applications', '0006_application_snapshot_contract')]

# DDL identical to migration 0004, used to fake a partially-applied database.
PARTIAL_EXPAND_SQL = """
ALTER TABLE applications_application ADD COLUMN IF NOT EXISTS submitted_at timestamp with time zone NULL;
ALTER TABLE applications_application ADD COLUMN IF NOT EXISTS submitted_cv_source varchar(30) NOT NULL DEFAULT 'builder';
ALTER TABLE applications_application ALTER COLUMN submitted_cv_source DROP DEFAULT;
ALTER TABLE applications_application ADD COLUMN IF NOT EXISTS submitted_cv_title varchar(255) NOT NULL DEFAULT '';
ALTER TABLE applications_application ALTER COLUMN submitted_cv_title DROP DEFAULT;
ALTER TABLE applications_application ADD COLUMN IF NOT EXISTS submitted_cv_version_id bigint NULL
    REFERENCES cvs_cvversion(id) DEFERRABLE INITIALLY DEFERRED;
CREATE INDEX IF NOT EXISTS applications_application_submitted_cv_version_id_f06bc64e
    ON applications_application(submitted_cv_version_id);
"""


class ApplicationSnapshotMigrationTests(TransactionTestCase):
    def _migrate(self, targets):
        executor = MigrationExecutor(connection)
        executor.loader.build_graph()
        executor.migrate(targets)
        return executor

    def _historical_application(self):
        executor = MigrationExecutor(connection)
        executor.loader.build_graph()
        return executor.loader.project_state(('applications', '0003_initial')).apps.get_model('applications', 'Application')

    def _seed_legacy_application(self, suffix='a', base_public_id=None):
        """Create a legacy Application (no snapshot) + a V1 baseline CvVersion."""
        candidate = get_user_model().objects.create_user(
            email=f'mig-cand-{suffix}@example.com', password='x', role='candidate', full_name='Legacy Candidate',
        )
        owner = get_user_model().objects.create_user(
            email=f'mig-owner-{suffix}@example.com', password='x', role='employer', full_name='Legacy Owner',
        )
        company = Company.objects.create(company_name=f'Legacy Co {suffix}', created_by=owner)
        job = Job.objects.create(title=f'Legacy Job {suffix}', description='d', company=company, posted_by=owner)
        cv = UserCv.objects.create(cv_type='builder', title=f'Legacy CV {suffix}', user=candidate)
        CvVersion.objects.create(
            public_id=base_public_id or f'cvv-base-{suffix}', version_number=1, cv=cv,
            plain_text='baseline', content_hash='deadbeef',
        )
        application = self._historical_application().objects.create(
            public_id=f'app-mig-{suffix}', candidate_id=candidate.pk, job_id=job.pk, cv_id=cv.pk, status='submitted',
        )
        return application.pk, cv

    @staticmethod
    def _run_sql(sql):
        with connection.cursor() as cursor:
            cursor.execute(sql)

    @staticmethod
    def _count_deterministic_snapshots(app_pk):
        return CvVersion.objects.filter(public_id=f'cvv-application-{app_pk}').count()

    def _assert_backfilled(self, app_pk, cv):
        application = global_apps.get_model('applications', 'Application').objects.get(pk=app_pk)
        self.assertIsNotNone(application.submitted_cv_version_id)
        self.assertEqual(application.submitted_cv_title, cv.title)
        self.assertEqual(application.submitted_cv_source, cv.source)
        snapshot = CvVersion.objects.get(pk=application.submitted_cv_version_id)
        self.assertEqual(snapshot.version_kind, 'application_snapshot')
        self.assertEqual(snapshot.cv_id, cv.pk)
        self.assertEqual(snapshot.public_id, f'cvv-application-{app_pk}')
        return snapshot

    # --- scenarios ---------------------------------------------------------

    def test_clean_database_migrates_forward(self):
        self._migrate(BEFORE)
        self._migrate(AFTER)
        # No applications: contract still enforces NOT NULL and the index exists.
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT is_nullable FROM information_schema.columns "
                "WHERE table_name='applications_application' AND column_name='submitted_cv_version_id'"
            )
            self.assertEqual(cursor.fetchone()[0], 'NO')

    def test_legacy_database_is_backfilled_and_contracted(self):
        self._migrate(BEFORE)
        app_pk, cv = self._seed_legacy_application()
        self._migrate(AFTER)
        self._assert_backfilled(app_pk, cv)

    def test_partial_migration_columns_exist_but_unrecorded(self):
        # Old monolithic migration added the columns then failed before being
        # recorded: schema is ahead of django_migrations.
        self._migrate(BEFORE)
        app_pk, cv = self._seed_legacy_application()
        self._run_sql(PARTIAL_EXPAND_SQL)  # columns now exist; migration still at 0003
        # migrate must recover without erroring on the already-present columns.
        self._migrate(AFTER)
        self._assert_backfilled(app_pk, cv)

    def test_existing_snapshot_is_reused_not_duplicated(self):
        self._migrate(BEFORE)
        app_pk, cv = self._seed_legacy_application()
        # A correct deterministic snapshot already exists from a prior partial run.
        CvVersion.objects.create(
            public_id=f'cvv-application-{app_pk}', version_number=2, cv=cv,
            version_kind='application_snapshot', plain_text='baseline', content_hash='deadbeef',
        )
        self._migrate(AFTER)
        snapshot = self._assert_backfilled(app_pk, cv)
        self.assertEqual(snapshot.version_number, 2)
        self.assertEqual(self._count_deterministic_snapshots(app_pk), 1)

    def test_repair_is_idempotent_when_run_twice(self):
        self._migrate(BEFORE)
        app_pk, cv = self._seed_legacy_application()
        self._migrate(EXPAND)  # columns exist, nullable, snapshot still missing

        out = StringIO()
        call_command('cv_snapshot_preflight', '--repair', stdout=out)
        self.assertEqual(self._count_deterministic_snapshots(app_pk), 1)
        self._assert_backfilled(app_pk, cv)

        # Second repair must be a no-op — no duplicate, still consistent.
        call_command('cv_snapshot_preflight', '--repair', stdout=StringIO())
        self.assertEqual(self._count_deterministic_snapshots(app_pk), 1)
        self._assert_backfilled(app_pk, cv)

    def test_mismatched_snapshot_is_refused(self):
        self._migrate(BEFORE)
        app_pk, cv = self._seed_legacy_application(suffix='a')
        _, other_cv = self._seed_legacy_application(suffix='b')
        # A deterministic snapshot exists but points at the WRONG cv — must not
        # be silently linked to the recruiter's application view.
        bad = CvVersion.objects.create(
            public_id=f'cvv-application-{app_pk}', version_number=2, cv=other_cv,
            version_kind='application_snapshot', plain_text='x', content_hash='x',
        )
        with self.assertRaises(RuntimeError):
            self._migrate(AFTER)
        # Repair from the fix: remove the corrupt row, then migration completes.
        bad.delete()
        self._migrate(AFTER)
        self._assert_backfilled(app_pk, cv)

    def tearDown(self):
        # Leave the database fully migrated forward for the rest of the suite.
        self._migrate(AFTER)
