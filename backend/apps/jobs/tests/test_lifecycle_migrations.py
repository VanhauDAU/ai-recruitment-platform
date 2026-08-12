from datetime import timedelta

from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase
from django.utils import timezone

BEFORE = [('jobs', '0040_job_status_created_desc_index')]
AFTER = [('jobs', '0042_backfill_job_lifecycle_v2')]


class JobLifecycleMigrationTests(TransactionTestCase):
    def _migrate(self, targets):
        executor = MigrationExecutor(connection)
        executor.loader.build_graph()
        executor.migrate(targets)
        return executor.loader.project_state(targets).apps

    def setUp(self):
        super().setUp()
        old_apps = self._migrate(BEFORE)
        user_model = old_apps.get_model('accounts', 'User')
        company_model = old_apps.get_model('employers', 'Company')
        job_model = old_apps.get_model('jobs', 'Job')
        history_model = old_apps.get_model('jobs', 'JobStatusHistory')

        user = user_model.objects.create(
            public_id='usr_lifecycle_migration',
            email='lifecycle-migration@example.com',
            password='unused',
            role='employer',
        )
        company = company_model.objects.create(
            public_id='cmp_lifecycle_migration',
            company_name='Lifecycle migration company',
            created_by=user,
        )
        now = timezone.now()
        self.job_id = job_model.objects.create(
            public_id='jb_lifecycle_migration',
            posted_by=user,
            company=company,
            title='Legacy lifecycle job',
            slug='legacy-lifecycle-job',
            description='Legacy content',
            status='active',
            deadline=(now - timedelta(days=30)).date(),
            published_at=now - timedelta(days=5),
            approved_at=now - timedelta(days=5),
        ).pk
        first_history = history_model.objects.create(
            job_id=self.job_id,
            from_status='pending',
            to_status='active',
            actor_role='admin',
        )
        history_model.objects.filter(pk=first_history.pk).update(
            created_at=now - timedelta(days=20)
        )

    def tearDown(self):
        executor = MigrationExecutor(connection)
        executor.loader.build_graph()
        executor.migrate(executor.loader.graph.leaf_nodes())
        super().tearDown()

    def test_backfill_is_idempotent_and_repairs_an_invalid_legacy_deadline(self):
        apps = self._migrate(AFTER)
        job_model = apps.get_model('jobs', 'Job')
        job = job_model.objects.get(pk=self.job_id)

        self.assertEqual(job.first_approved_at, job.visibility_starts_at)
        self.assertGreater(job.visibility_ends_at, job.visibility_starts_at)
        self.assertEqual(job.requested_visibility_days, 1)

        original_window = (
            job.first_approved_at,
            job.visibility_starts_at,
            job.visibility_ends_at,
            job.requested_visibility_days,
        )
        apps = self._migrate(AFTER)
        job = apps.get_model('jobs', 'Job').objects.get(pk=self.job_id)
        self.assertEqual(
            (
                job.first_approved_at,
                job.visibility_starts_at,
                job.visibility_ends_at,
                job.requested_visibility_days,
            ),
            original_window,
        )
