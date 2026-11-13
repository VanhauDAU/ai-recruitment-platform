from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase

# Keep employers and accounts at their current schema while jobs is migrated
# backward; see test_lifecycle_migrations for why the historical state needs it.
EMPLOYERS_LEAF = ('employers', '0047_company_public_search_indexes')
ACCOUNTS_LEAF = ('accounts', '0030_remove_two_factor')
BEFORE = [('jobs', '0045_candidate_hidden_job'), EMPLOYERS_LEAF, ACCOUNTS_LEAF]
AFTER = [('jobs', '0047_remove_job_approval_states'), EMPLOYERS_LEAF, ACCOUNTS_LEAF]
CONVERSION_NOTE = 'Chuyển về bản nháp khi bỏ quy trình duyệt tin (ADR-0014).'


class JobPostModerationMigrationTests(TransactionTestCase):
    def _migrate(self, targets):
        executor = MigrationExecutor(connection)
        executor.loader.build_graph()
        executor.migrate(targets)
        return executor.loader.project_state(targets).apps

    def setUp(self):
        super().setUp()
        old_apps = self._migrate(BEFORE)
        user = old_apps.get_model('accounts', 'User').objects.create(
            public_id='usr_post_moderation_migration',
            email='post-moderation-migration@example.com',
            password='unused',
            role='employer',
        )
        company = old_apps.get_model('employers', 'Company').objects.create(
            public_id='cmp_post_moderation_migration',
            company_name='Post-moderation migration company',
            created_by=user,
        )
        job_model = old_apps.get_model('jobs', 'Job')
        self.job_ids = {}
        for status, rejected_reason in (
            ('pending', ''),
            ('rejected', 'Thiếu thông tin mức lương.'),
            ('active', ''),
        ):
            self.job_ids[status] = job_model.objects.create(
                public_id=f'jb_post_moderation_{status}',
                posted_by=user,
                company=company,
                title=f'Legacy {status} job',
                slug=f'legacy-{status}-job',
                description='Legacy content',
                status=status,
                rejected_reason=rejected_reason,
            ).pk

    def tearDown(self):
        executor = MigrationExecutor(connection)
        executor.loader.build_graph()
        executor.migrate(executor.loader.graph.leaf_nodes())
        super().tearDown()

    def test_review_states_become_drafts_with_a_system_history_entry(self):
        apps = self._migrate(AFTER)
        job_model = apps.get_model('jobs', 'Job')
        history_model = apps.get_model('jobs', 'JobStatusHistory')

        self.assertEqual(
            dict(job_model.objects.values_list('pk', 'status')),
            {
                self.job_ids['pending']: 'draft',
                self.job_ids['rejected']: 'draft',
                self.job_ids['active']: 'active',
            },
        )
        self.assertEqual(
            list(
                history_model.objects.order_by('job_id').values_list(
                    'job_id', 'from_status', 'to_status', 'actor_role', 'note'
                )
            ),
            [
                (self.job_ids['pending'], 'pending', 'draft', 'system', CONVERSION_NOTE),
                (self.job_ids['rejected'], 'rejected', 'draft', 'system', CONVERSION_NOTE),
            ],
        )
        self.assertNotIn(
            'rejected_reason',
            [field.name for field in job_model._meta.get_fields()],
        )
