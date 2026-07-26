"""Nhật ký hoạt động của tài khoản quản trị: ghi log tự phục vụ và endpoint đọc."""

from django.core.cache import cache
from django.db import connection
from django.test import TestCase
from django.test.utils import CaptureQueriesContext
from django.urls import reverse
from rest_framework.test import APIClient

from apps.accounts.models import AdminAccessAuditLog, AdminPermission, AdminRole, Department, User
from apps.accounts.services import assign_membership, record_admin_self_action


class AdminAuditLogApiTests(TestCase):
    def setUp(self):
        self.superuser = User.objects.create_user(
            'root@example.com',
            'TestPass123',
            role=User.Role.ADMIN,
            status=User.Status.ACTIVE,
            is_superuser=True,
            is_staff=True,
            two_factor_enabled=True,
        )
        self.staff = User.objects.create_user(
            'staff@example.com',
            'TestPass123',
            role=User.Role.ADMIN,
            status=User.Status.ACTIVE,
            two_factor_enabled=True,
        )
        self.candidate = User.objects.create_user('candidate@example.com', 'TestPass123')
        self.client = APIClient()
        self.url = reverse('admin-audit-log-list')

    def _grant_audit_permission(self):
        department = Department.objects.create(code='ops', name='Vận hành')
        role = AdminRole.objects.create(department=department, code='auditor', name='Kiểm toán')
        role.permissions.add(
            AdminPermission.objects.create(
                code='audit_log.view',
                module='audit_log',
                label='Xem lịch sử phân quyền',
            )
        )
        assign_membership(self.staff, role, actor=self.superuser)
        # `_schedule_cache_bust` chạy trong `transaction.on_commit`, không kích
        # hoạt bên trong TestCase — xoá tay để đọc quyền vừa cấp.
        cache.clear()

    def test_admin_without_department_sees_only_its_own_log(self):
        record_admin_self_action(self.staff, 'self_password_change')
        record_admin_self_action(self.superuser, 'self_password_change')

        self.client.force_authenticate(self.staff)
        response = self.client.get(self.url)

        self.assertEqual(response.status_code, 200, response.data)
        results = response.json()['results']
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['actor_email'], self.staff.email)
        self.assertEqual(results[0]['action'], 'self_password_change')

    def test_scope_all_requires_audit_log_view_permission(self):
        record_admin_self_action(self.superuser, 'self_password_change')

        self.client.force_authenticate(self.staff)
        denied = self.client.get(self.url, {'scope': 'all'})
        self.assertEqual(denied.status_code, 403)
        self.assertEqual(denied.json()['code'], 'admin_permission_denied')

        self._grant_audit_permission()
        allowed = self.client.get(self.url, {'scope': 'all'})
        self.assertEqual(allowed.status_code, 200, allowed.data)
        actors = {row['actor_email'] for row in allowed.json()['results']}
        self.assertIn(self.superuser.email, actors)

    def test_superuser_scope_all_covers_rbac_actions_and_filters_by_action(self):
        self._grant_audit_permission()  # sinh log `assign_membership`
        record_admin_self_action(self.superuser, 'self_mfa_enable', {'method': 'totp'})

        self.client.force_authenticate(self.superuser)
        filtered = self.client.get(self.url, {'scope': 'all', 'action': 'assign_membership'})

        self.assertEqual(filtered.status_code, 200, filtered.data)
        actions = {row['action'] for row in filtered.json()['results']}
        self.assertEqual(actions, {'assign_membership'})

    def test_non_admin_accounts_are_rejected(self):
        self.client.force_authenticate(self.candidate)
        self.assertEqual(self.client.get(self.url).status_code, 403)

        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(self.url).status_code, 401)

    def test_list_query_count_is_flat_in_the_number_of_rows(self):
        self.client.force_authenticate(self.superuser)
        self._grant_audit_permission()

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
        self.admin = User.objects.create_user(
            'admin-activity@example.com',
            'TestPass123',
            role=User.Role.ADMIN,
            status=User.Status.ACTIVE,
            email_verified=True,
            two_factor_enabled=True,
        )
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
