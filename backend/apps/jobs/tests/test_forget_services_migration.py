from importlib import import_module

from django.apps import apps
from django.contrib.admin.models import LogEntry
from django.contrib.auth.models import Group, Permission
from django.contrib.contenttypes.models import ContentType
from django.db import connection
from django.db.migrations.recorder import MigrationRecorder
from django.test import TestCase

from apps.accounts.models import User

forget_services_app = import_module(
    'apps.jobs.migrations.0049_forget_services_app'
).forget_services_app


class ForgetServicesAppMigrationTests(TestCase):
    def test_removes_content_types_permissions_logs_and_migration_rows(self):
        removed_type = ContentType.objects.create(app_label='services', model='servicepackage')
        kept_type = ContentType.objects.get_for_model(User)
        permission = Permission.objects.create(
            content_type=removed_type, codename='view_servicepackage', name='View'
        )
        group = Group.objects.create(name='Former service staff')
        group.permissions.add(permission)
        admin = User.objects.create_user(
            email='forget-services@example.com', password='Password@123', role=User.Role.ADMIN
        )
        LogEntry.objects.create(
            user=admin, content_type=removed_type, object_repr='Package', action_flag=1
        )
        recorder = MigrationRecorder(connection)
        recorder.record_applied('services', '0012_drop_service_tables')

        with connection.schema_editor() as schema_editor:
            forget_services_app(apps, schema_editor)

        self.assertFalse(ContentType.objects.filter(app_label='services').exists())
        self.assertFalse(Permission.objects.filter(pk=permission.pk).exists())
        self.assertFalse(group.permissions.exists())
        self.assertFalse(LogEntry.objects.filter(content_type_id=removed_type.pk).exists())
        self.assertFalse(recorder.migration_qs.filter(app='services').exists())
        self.assertTrue(ContentType.objects.filter(pk=kept_type.pk).exists())
