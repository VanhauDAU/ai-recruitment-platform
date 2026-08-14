from django.contrib.auth import get_user_model
from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase

BEFORE = [('candidates', '0006_opt_in_suitable_job_recommendations')]
AFTER = [('candidates', '0007_candidate_preference_positions_and_skills')]


class CandidatePreferenceMigrationTests(TransactionTestCase):
    def _migrate(self, targets):
        executor = MigrationExecutor(connection)
        executor.loader.build_graph()
        executor.migrate(targets)
        return executor

    def tearDown(self):
        executor = MigrationExecutor(connection)
        executor.loader.build_graph()
        executor.migrate(executor.loader.graph.leaf_nodes())
        super().tearDown()

    def test_backfills_trimmed_legacy_scalar_into_canonical_child_row(self):
        before_executor = self._migrate(BEFORE)
        old_apps = before_executor.loader.project_state(BEFORE).apps
        OldPreference = old_apps.get_model('candidates', 'CandidateJobPreference')
        OldProfile = old_apps.get_model('candidates', 'CandidateProfile')

        user = get_user_model().objects.create_user(
            email='candidate-preference-migration@example.com',
            password='password',
            role='candidate',
        )
        profile = OldProfile.objects.get(user_id=user.pk)
        preference = OldPreference.objects.create(
            candidate_profile=profile,
            desired_position_other='  AI Engineer  ',
        )

        after_executor = self._migrate(AFTER)
        apps = after_executor.loader.project_state(AFTER).apps
        NewPreference = apps.get_model('candidates', 'CandidateJobPreference')
        CustomPosition = apps.get_model('candidates', 'CandidateDesiredPositionOther')

        self.assertEqual(
            NewPreference.objects.get(pk=preference.pk).desired_position_other,
            'AI Engineer',
        )
        self.assertEqual(
            list(
                CustomPosition.objects.filter(job_preference_id=preference.pk).values_list(
                    'name',
                    'sort_order',
                )
            ),
            [('AI Engineer', 0)],
        )
