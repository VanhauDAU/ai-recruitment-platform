from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase

BEFORE = [('jobs', '0038_jobaigeneration')]
AFTER = [('jobs', '0039_repair_job_ai_generation_applied_diff')]


class JobAiGenerationRepairMigrationTests(TransactionTestCase):
    def _migrate(self, targets):
        executor = MigrationExecutor(connection)
        executor.loader.build_graph()
        executor.migrate(targets)

    @staticmethod
    def _column_contract():
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT is_nullable, column_default
                FROM information_schema.columns
                WHERE table_name = 'jobs_jobaigeneration'
                  AND column_name = 'applied_diff'
                """
            )
            return cursor.fetchone()

    def test_repairs_database_that_recorded_0038_without_applied_diff(self):
        self._migrate(BEFORE)
        with connection.cursor() as cursor:
            cursor.execute(
                'ALTER TABLE "jobs_jobaigeneration" DROP COLUMN IF EXISTS "applied_diff"'
            )

        self.assertIsNone(self._column_contract())
        self._migrate(AFTER)

        # Existing rows are backfilled by the temporary database default, but
        # future writes continue to use the Django model default.
        self.assertEqual(self._column_contract(), ('NO', None))

        # Rebuilding the executor at the same target must remain a safe no-op.
        self._migrate(AFTER)
        self.assertEqual(self._column_contract(), ('NO', None))

    def tearDown(self):
        executor = MigrationExecutor(connection)
        executor.loader.build_graph()
        self._migrate(executor.loader.graph.leaf_nodes())
