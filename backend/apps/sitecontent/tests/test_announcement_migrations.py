from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase


class AnnouncementMigrationTests(TransactionTestCase):
    migrate_from = [
        ('accounts', '0018_admin_employer_operations_permissions'),
        ('sitecontent', '0015_fix_employer_footer_links'),
    ]
    migrate_to = [
        ('accounts', '0019_announcement_permissions'),
        ('sitecontent', '0016_announcement_announcementrevision_and_more'),
    ]

    def setUp(self):
        super().setUp()
        executor = MigrationExecutor(connection)
        executor.migrate(self.migrate_from)
        old_apps = executor.loader.project_state(self.migrate_from).apps
        department_model = old_apps.get_model('accounts', 'Department')
        role_model = old_apps.get_model('accounts', 'AdminRole')
        department = department_model.objects.create(
            public_id='dept_announcement_test',
            code='content-cv',
            name='Nội dung & CV',
            is_system_managed=True,
        )
        role_model.objects.create(
            public_id='arole_announcement_test',
            department=department,
            code='manager',
            name='Trưởng phòng',
            rank=100,
            is_system_managed=True,
        )

    def tearDown(self):
        executor = MigrationExecutor(connection)
        executor.migrate(executor.loader.graph.leaf_nodes())
        super().tearDown()

    def test_forward_reverse_and_permission_seed_are_additive(self):
        executor = MigrationExecutor(connection)
        executor.migrate(self.migrate_to)
        apps = executor.loader.project_state(self.migrate_to).apps
        permission_model = apps.get_model('accounts', 'AdminPermission')
        role_model = apps.get_model('accounts', 'AdminRole')

        self.assertEqual(
            set(
                permission_model.objects.filter(code__startswith='announcement.').values_list(
                    'code',
                    flat=True,
                )
            ),
            {
                'announcement.view',
                'announcement.manage',
                'announcement.publish',
            },
        )
        manager = role_model.objects.get(department__code='content-cv', code='manager')
        self.assertTrue(manager.permissions.filter(code='announcement.publish').exists())
        self.assertIn('sitecontent_announcement', connection.introspection.table_names())

        executor = MigrationExecutor(connection)
        executor.migrate(self.migrate_from)
        self.assertNotIn('sitecontent_announcement', connection.introspection.table_names())
        self.assertTrue(permission_model.objects.filter(code='announcement.view').exists())
