"""Upgrade test for the application-snapshot expand/backfill/contract migrations.

Reproduces the exact failure mode the split migrations fix: a database that
already holds a legacy ``Application`` (created before the snapshot columns
existed) must migrate all the way to the contracted NOT NULL FK without hitting
PostgreSQL's "pending trigger events" error, and every legacy row must come out
with a durable snapshot.

Uses ``MigrationExecutor`` against the real database, so it only passes on the
PostgreSQL engine the project actually deploys on.
"""

from django.apps import apps as global_apps
from django.contrib.auth import get_user_model
from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase

from apps.cvs.models import CvVersion, UserCv
from apps.employers.models import Company
from apps.jobs.models import Job


class ApplicationSnapshotMigrationTests(TransactionTestCase):
    # Only applications is rewound; every other app stays at its latest schema
    # so the current ORM models match the tables we seed the FK chain with.
    before = [('applications', '0003_initial')]
    after = [('applications', '0006_application_snapshot_contract')]

    def _migrate(self, targets):
        executor = MigrationExecutor(connection)
        executor.loader.build_graph()
        executor.migrate(targets)
        return executor

    def _seed_legacy_application(self):
        """Create a legacy Application (no snapshot) via the historical model."""
        candidate = get_user_model().objects.create_user(
            email='mig-candidate@example.com', password='x', role='candidate', full_name='Legacy Candidate',
        )
        owner = get_user_model().objects.create_user(
            email='mig-owner@example.com', password='x', role='employer', full_name='Legacy Owner',
        )
        company = Company.objects.create(company_name='Legacy Co', created_by=owner)
        job = Job.objects.create(title='Legacy Job', description='d', company=company, posted_by=owner)
        cv = UserCv.objects.create(cv_type='builder', title='Legacy CV', user=candidate)
        # V1 baseline the backfill snapshots from (normally created by cvs.0002).
        CvVersion.objects.create(public_id='cvv-mig-base', version_number=1, cv=cv, plain_text='baseline', content_hash='deadbeef')

        executor = MigrationExecutor(connection)
        executor.loader.build_graph()
        HistoricalApplication = executor.loader.project_state(('applications', '0003_initial')).apps.get_model('applications', 'Application')
        application = HistoricalApplication.objects.create(
            public_id='app-mig', candidate_id=candidate.pk, job_id=job.pk, cv_id=cv.pk, status='submitted',
        )
        return application.pk, cv.title

    def test_legacy_application_is_backfilled_and_contracted(self):
        # Rewind applications to before the snapshot columns existed.
        self._migrate(self.before)
        app_pk, cv_title = self._seed_legacy_application()

        # Roll all the way forward. This is the step that used to fail with
        # "cannot ALTER TABLE ... because it has pending trigger events".
        self._migrate(self.after)

        # Assert the legacy application now has a durable, snapshotted version.
        Application = global_apps.get_model('applications', 'Application')
        application = Application.objects.get(pk=app_pk)
        self.assertIsNotNone(application.submitted_cv_version_id)
        self.assertEqual(application.submitted_cv_title, cv_title)
        self.assertEqual(application.submitted_cv_source, 'builder')
        snapshot = CvVersion.objects.get(pk=application.submitted_cv_version_id)
        self.assertEqual(snapshot.version_kind, 'application_snapshot')
        self.assertEqual(snapshot.public_id, f'cvv-application-{app_pk}')

    def tearDown(self):
        # Leave the database fully migrated forward for the rest of the suite.
        self._migrate(self.after)
