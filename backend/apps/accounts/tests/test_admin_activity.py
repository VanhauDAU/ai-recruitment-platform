"""Nhật ký hoạt động của tài khoản quản trị: ghi log tự phục vụ và endpoint đọc."""

from django.db import connection
from django.test import TestCase
from django.test.utils import CaptureQueriesContext
from django.urls import reverse
from rest_framework.test import APIClient

from apps.accounts.models import AdminAccessAuditLog, User
from apps.accounts.services import record_admin_self_action
from apps.accounts.tests.helpers import make_admin


class AdminAuditLogApiTests(TestCase):
    def setUp(self):
        self.superuser = make_admin('root@example.com', superuser=True)
        self.staff = make_admin('staff@example.com')
        self.candidate = User.objects.create_user('candidate@example.com', 'TestPass123')
        self.client = APIClient()
        self.url = reverse('admin-audit-log-list')

    def test_regular_admin_sees_only_its_own_log(self):
        record_admin_self_action(self.staff, 'self_password_change')
        record_admin_self_action(self.superuser, 'self_password_change')

        self.client.force_authenticate(self.staff)
        response = self.client.get(self.url)

        self.assertEqual(response.status_code, 200, response.data)
        results = response.json()['results']
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['actor_email'], self.staff.email)
        self.assertEqual(results[0]['action'], 'self_password_change')

    def test_superuser_scope_all_covers_every_actor_and_filters_by_action(self):
        record_admin_self_action(self.staff, 'self_password_change')
        record_admin_self_action(self.superuser, 'self_session_revoke')

        self.client.force_authenticate(self.superuser)
        everything = self.client.get(self.url, {'scope': 'all'})
        filtered = self.client.get(self.url, {'scope': 'all', 'action': 'self_password_change'})

        self.assertEqual(everything.status_code, 200, everything.data)
        actors = {row['actor_email'] for row in everything.json()['results']}
        self.assertEqual(actors, {self.staff.email, self.superuser.email})
        self.assertEqual(filtered.status_code, 200, filtered.data)
        self.assertEqual(
            [row['actor_email'] for row in filtered.json()['results']],
            [self.staff.email],
        )

    def test_non_admin_accounts_are_rejected(self):
        self.client.force_authenticate(self.candidate)
        self.assertEqual(self.client.get(self.url).status_code, 403)

        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(self.url).status_code, 401)

    def test_list_query_count_is_flat_in_the_number_of_rows(self):
        self.client.force_authenticate(self.superuser)

        for index in range(3):
            record_admin_self_action(self.superuser, 'self_session_revoke', {'index': index})
        with CaptureQueriesContext(connection) as few:
            self.client.get(self.url, {'scope': 'all'})

        for index in range(10):
            record_admin_self_action(self.superuser, 'self_session_revoke', {'index': index})
        with CaptureQueriesContext(connection) as many:
            self.client.get(self.url, {'scope': 'all'})

        self.assertEqual(len(many.captured_queries), len(few.captured_queries))


class AdminSelfActionAuditTests(TestCase):
    """Các view dùng chung chỉ ghi audit cho tài khoản admin."""

    def setUp(self):
        self.admin = make_admin('admin-activity@example.com', email_verified=True)
        self.candidate = User.objects.create_user('candidate-activity@example.com', 'TestPass123')
        self.client = APIClient()

    def test_profile_update_is_audited_for_admin_only(self):
        self.client.force_authenticate(self.admin)
        response = self.client.patch(reverse('auth-me'), {'full_name': 'Quản trị viên'})
        self.assertEqual(response.status_code, 200, response.data)

        log = AdminAccessAuditLog.objects.get(action='self_profile_update')
        self.assertEqual(log.actor, self.admin)
        self.assertEqual(log.target_public_id, self.admin.public_id)
        self.assertEqual(log.payload['fields'], ['full_name'])

        self.client.force_authenticate(self.candidate)
        self.client.patch(reverse('auth-me'), {'full_name': 'Ứng viên'})
        self.assertEqual(
            AdminAccessAuditLog.objects.filter(action='self_profile_update').count(), 1
        )

    def test_record_admin_self_action_ignores_non_admin_accounts(self):
        self.assertIsNone(record_admin_self_action(self.candidate, 'self_password_change'))
        self.assertFalse(AdminAccessAuditLog.objects.exists())
