from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase


class AnnouncementMigrationTests(TransactionTestCase):
    migrate_from = [('sitecontent', '0015_fix_employer_footer_links')]
    migrate_to = [('sitecontent', '0016_announcement_announcementrevision_and_more')]

    def tearDown(self):
        executor = MigrationExecutor(connection)
        executor.migrate(executor.loader.graph.leaf_nodes())
        super().tearDown()

    def test_announcement_tables_migrate_forward_and_reverse(self):
        executor = MigrationExecutor(connection)
        executor.migrate(self.migrate_from)
        self.assertNotIn('sitecontent_announcement', connection.introspection.table_names())

        executor = MigrationExecutor(connection)
        executor.migrate(self.migrate_to)
        self.assertIn('sitecontent_announcement', connection.introspection.table_names())
