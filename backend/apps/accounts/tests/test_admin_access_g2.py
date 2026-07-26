import importlib
import json
import threading
from types import SimpleNamespace
from unittest.mock import patch

from django.apps import apps as django_apps
from django.core import management
from django.core.exceptions import ValidationError
from django.core.management.base import CommandError
from django.db import IntegrityError, close_old_connections, connection, transaction
from django.test import TestCase, TransactionTestCase
from django.test.utils import CaptureQueriesContext
from django.urls import reverse
from rest_framework.test import APIClient

from apps.accounts.admin_access_rules import StaleImpactToken, create_impact_token
from apps.accounts.constants import system_role_definition
from apps.accounts.models import (
    AdminAccessAuditLog,
    AdminMembership,
    AdminPermission,
    AdminRole,
    Department,
    User,
)
from apps.accounts.permissions import HasAdminPermission
from apps.accounts.selectors import (
    current_rbac_revision,
    department_status_impact,
    membership_assignment_impact,
    role_permissions_impact,
    role_status_impact,
)
from apps.accounts.services import (
    assign_membership,
    confirm_membership_assignment,
    confirm_role_status_change,
    restore_system_role,
    set_role_permissions,
)
from common.public_id import generate_public_id


class AdminAccessG2ApiTests(TestCase):
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
        self.admin = User.objects.create_user(
            'manager@example.com',
            'TestPass123',
            role=User.Role.ADMIN,
            status=User.Status.ACTIVE,
            two_factor_enabled=True,
        )
        self.staff = User.objects.create_user(
            'staff@example.com',
            'TestPass123',
            role=User.Role.ADMIN,
            status=User.Status.ACTIVE,
            two_factor_enabled=False,
        )
        self.department = Department.objects.create(
            code='content-cv',
            name='Nội dung & CV',
            description='Mặc định',
            is_system_managed=True,
        )
        self.role = AdminRole.objects.create(
            department=self.department,
            code='staff',
            name='Nhân viên',
            description='Mặc định',
            rank=10,
            is_system_managed=True,
        )
        self.view_permission = AdminPermission.objects.create(
            code='admin_access.view',
            module='admin_access',
            label='Xem phân quyền',
        )
        self.department_permission = AdminPermission.objects.create(
            code='admin_access.manage_department',
            module='admin_access',
            label='Quản lý phòng ban',
        )
        self.role_permission = AdminPermission.objects.create(
            code='admin_access.manage_role',
            module='admin_access',
            label='Quản lý chức danh',
        )
        self.staff_permission = AdminPermission.objects.create(
            code='admin_access.manage_staff',
            module='admin_access',
            label='Quản lý nhân viên',
        )
        self.business_permission = AdminPermission.objects.create(
            code='cv_template.view',
            module='cv_template',
            label='Xem CV',
        )
        self.role.permissions.add(
            self.view_permission,
            self.department_permission,
            self.role_permission,
            self.staff_permission,
            self.business_permission,
        )
        assign_membership(self.admin, self.role, actor=self.superuser)
        self.client = APIClient()

    def authenticate(self, user):
        self.client.force_authenticate(user)

    def test_real_url_mount_and_two_read_levels(self):
        self.authenticate(self.admin)
        response = self.client.get(reverse('admin-department-list'))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()[0]['active_member_count'], 1)

        for name in ('admin-staff-list', 'admin-membership-list'):
            response = self.client.get(reverse(name))
            self.assertEqual(response.status_code, 403)
            self.assertEqual(response.json()['code'], 'admin_permission_denied')

    def test_every_write_and_impact_is_superuser_only(self):
        self.authenticate(self.admin)
        membership = AdminMembership.objects.get(user=self.admin, role=self.role)
        department_kwargs = {'public_id': self.department.public_id}
        role_kwargs = {'public_id': self.role.public_id}
        membership_kwargs = {'public_id': membership.public_id}
        requests = [
            ('post', reverse('admin-department-list'), {'code': 'ops', 'name': 'Ops'}),
            (
                'patch',
                reverse('admin-department-detail', kwargs=department_kwargs),
                {'name': 'Tên mới'},
            ),
            ('post', reverse('admin-department-activate', kwargs=department_kwargs), {}),
            ('post', reverse('admin-department-deactivate', kwargs=department_kwargs), {}),
            (
                'post',
                reverse('admin-department-status-impact', kwargs=department_kwargs),
                {'is_active': False},
            ),
            (
                'get',
                reverse('admin-department-restore-system-default', kwargs=department_kwargs),
                {},
            ),
            (
                'post',
                reverse('admin-department-restore-system-default', kwargs=department_kwargs),
                {},
            ),
            (
                'post',
                reverse('admin-role-list'),
                {'department': self.department.public_id, 'code': 'reviewer', 'name': 'Reviewer'},
            ),
            ('patch', reverse('admin-role-detail', kwargs=role_kwargs), {'name': 'Tên mới'}),
            ('post', reverse('admin-role-activate', kwargs=role_kwargs), {}),
            ('post', reverse('admin-role-deactivate', kwargs=role_kwargs), {}),
            (
                'post',
                reverse('admin-role-status-impact', kwargs=role_kwargs),
                {'is_active': False},
            ),
            (
                'post',
                reverse('admin-role-permissions-impact', kwargs=role_kwargs),
                {'permission_codes': ['cv_template.view']},
            ),
            (
                'put',
                reverse('admin-role-permissions', kwargs=role_kwargs),
                {'permission_codes': ['cv_template.view']},
            ),
            ('get', reverse('admin-role-restore-system-default', kwargs=role_kwargs), {}),
            ('post', reverse('admin-role-restore-system-default', kwargs=role_kwargs), {}),
            ('post', reverse('admin-membership-assignment-impact'), {}),
            ('post', reverse('admin-membership-list'), {}),
            ('get', reverse('admin-membership-revoke-impact', kwargs=membership_kwargs), {}),
            ('post', reverse('admin-membership-revoke', kwargs=membership_kwargs), {}),
        ]
        for method, url, payload in requests:
            response = getattr(self.client, method)(url, payload, format='json')
            self.assertEqual(response.status_code, 403)
            self.assertEqual(response.json()['code'], 'admin_permission_denied')

    def test_department_noop_keeps_system_management_and_real_change_customizes(self):
        self.authenticate(self.superuser)
        url = reverse(
            'admin-department-detail',
            kwargs={'public_id': self.department.public_id},
        )
        before_audits = AdminAccessAuditLog.objects.count()
        response = self.client.patch(
            url,
            {'name': '  Nội dung & CV  ', 'description': ' Mặc định '},
            format='json',
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()['is_system_managed'])
        self.assertEqual(AdminAccessAuditLog.objects.count(), before_audits)

        response = self.client.patch(url, {'name': 'Nội dung tuỳ chỉnh'}, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.json()['is_system_managed'])
        self.assertEqual(AdminAccessAuditLog.objects.count(), before_audits + 1)

    def test_duplicate_codes_are_400(self):
        self.authenticate(self.superuser)
        response = self.client.post(
            reverse('admin-department-list'),
            {'code': self.department.code, 'name': 'Trùng'},
            format='json',
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn('code', response.json())

        response = self.client.post(
            reverse('admin-role-list'),
            {
                'department': self.department.public_id,
                'code': self.role.code,
                'name': 'Trùng',
                'rank': 1,
            },
            format='json',
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn('code', response.json())

    def test_status_preview_is_read_only_and_token_confirms_exact_payload(self):
        self.authenticate(self.superuser)
        impact_url = reverse(
            'admin-role-status-impact',
            kwargs={'public_id': self.role.public_id},
        )
        preview = self.client.post(impact_url, {'is_active': False}, format='json')
        self.assertEqual(preview.status_code, 200)
        self.role.refresh_from_db()
        self.assertTrue(self.role.is_active)
        self.assertLessEqual(
            preview.json()['effective_users_changed_count'],
            preview.json()['active_membership_count'],
        )

        activate_url = reverse(
            'admin-role-activate',
            kwargs={'public_id': self.role.public_id},
        )
        wrong_action = self.client.post(
            activate_url,
            {'impact_token': preview.json()['impact_token']},
            format='json',
        )
        self.assertEqual(wrong_action.status_code, 409)
        self.assertEqual(wrong_action.json()['code'], 'admin_resource_changed')

        deactivate_url = reverse(
            'admin-role-deactivate',
            kwargs={'public_id': self.role.public_id},
        )
        response = self.client.post(
            deactivate_url,
            {'impact_token': preview.json()['impact_token']},
            format='json',
        )
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.json()['is_active'])

        activate_preview = self.client.post(
            impact_url,
            {'is_active': True},
            format='json',
        )
        self.assertEqual(activate_preview.status_code, 200)
        self.assertGreaterEqual(
            activate_preview.json()['effective_users_changed_count'],
            1,
        )

    def test_impact_counts_ignore_locked_structure_and_replaced_memberships(self):
        locked_role = AdminRole.objects.create(
            department=self.department,
            code='locked',
            name='Đã khoá',
        )
        locked_role.permissions.add(self.business_permission)
        assign_membership(self.staff, locked_role, actor=self.superuser)
        locked_role.is_active = False
        locked_role.save(update_fields=['is_active'])

        department_impact = department_status_impact(self.department, is_active=False)
        self.assertEqual(department_impact['active_membership_count'], 1)

        shared_department = Department.objects.create(code='shared', name='Shared')
        first_role = AdminRole.objects.create(
            department=shared_department,
            code='first',
            name='First',
        )
        second_role = AdminRole.objects.create(
            department=shared_department,
            code='second',
            name='Second',
        )
        first_role.permissions.add(self.business_permission)
        second_role.permissions.add(self.business_permission)
        shared_user = User.objects.create_user(
            'shared@example.com',
            'TestPass123',
            role=User.Role.ADMIN,
            status=User.Status.ACTIVE,
        )
        first_membership = assign_membership(shared_user, first_role, actor=self.superuser)
        assign_membership(shared_user, second_role, actor=self.superuser)
        first_membership.refresh_from_db()
        self.assertFalse(first_membership.is_active)

        impact = role_permissions_impact(first_role, permission_codes=[])
        self.assertEqual(impact['active_membership_count'], 0)
        self.assertEqual(impact['effective_users_changed_count'], 0)
        self.assertEqual(impact['affected_user_count'], 0)

        shared_department.is_active = False
        shared_department.save(update_fields=['is_active'])
        inactive_impact = role_permissions_impact(first_role, permission_codes=[])
        self.assertEqual(inactive_impact['active_membership_count'], 0)
        self.assertEqual(inactive_impact['effective_users_changed_count'], 0)

    def test_permission_impact_blocks_empty_role_with_active_members(self):
        self.authenticate(self.superuser)
        impact_url = reverse(
            'admin-role-permissions-impact',
            kwargs={'public_id': self.role.public_id},
        )
        preview = self.client.post(
            impact_url,
            {'permission_codes': []},
            format='json',
        )
        self.assertEqual(preview.status_code, 200)
        self.assertFalse(preview.json()['can_apply'])
        self.assertTrue(preview.json()['blocking_reason'])

        update_url = reverse(
            'admin-role-permissions',
            kwargs={'public_id': self.role.public_id},
        )
        response = self.client.put(
            update_url,
            {
                'permission_codes': [],
                'impact_token': preview.json()['impact_token'],
            },
            format='json',
        )
        self.assertEqual(response.status_code, 400)

    def test_empty_permissions_are_allowed_when_only_revoked_memberships_remain(self):
        role = AdminRole.objects.create(
            department=self.department,
            code='former',
            name='Former',
        )
        role.permissions.add(self.business_permission)
        membership = assign_membership(self.staff, role, actor=self.superuser)
        membership.is_active = False
        membership.is_primary = False
        membership.save(update_fields=['is_active', 'is_primary'])

        set_role_permissions(
            role,
            [],
            actor=self.superuser,
            mark_customized=True,
        )

        role.refresh_from_db()
        self.assertFalse(role.permissions.exists())

    def test_permission_picker_keeps_granted_deprecated_permission(self):
        deprecated = AdminPermission.objects.create(
            code='cv_template.legacy',
            module='cv_template',
            label='Quyền cũ',
            is_active=False,
        )
        self.role.permissions.add(deprecated)
        self.authenticate(self.superuser)
        response = self.client.get(
            reverse('admin-permission-list'),
            {'role': self.role.public_id},
        )
        self.assertEqual(response.status_code, 200)
        legacy = next(item for item in response.json() if item['code'] == deprecated.code)
        self.assertFalse(legacy['is_active'])
        self.assertTrue(legacy['is_granted_to_role'])

    def test_assignment_preview_mfa_and_confirm(self):
        self.authenticate(self.superuser)
        preview = self.client.post(
            reverse('admin-membership-assignment-impact'),
            {
                'user_public_id': self.staff.public_id,
                'role_public_id': self.role.public_id,
            },
            format='json',
        )
        self.assertEqual(preview.status_code, 200)
        self.assertTrue(preview.json()['mfa_warning'])
        self.assertIn('cv_template.view', preview.json()['permissions_gained'])

        response = self.client.post(
            reverse('admin-membership-list'),
            {
                'user_public_id': self.staff.public_id,
                'role_public_id': self.role.public_id,
                'impact_token': preview.json()['impact_token'],
            },
            format='json',
        )
        self.assertEqual(response.status_code, 201)
        self.assertTrue(response.json()['is_active'])
        self.assertNotIn('is_primary', response.json())

    def test_assignment_rejects_empty_permission_role(self):
        empty_role = AdminRole.objects.create(
            department=self.department,
            code='empty',
            name='Chưa cấu hình',
        )
        with self.assertRaises(ValidationError):
            assign_membership(self.staff, empty_role, actor=self.superuser)

    def test_restore_department_preserves_operational_status(self):
        self.department.name = 'Tên tuỳ chỉnh'
        self.department.is_active = False
        self.department.is_system_managed = False
        self.department.save()
        self.authenticate(self.superuser)
        url = reverse(
            'admin-department-restore-system-default',
            kwargs={'public_id': self.department.public_id},
        )
        preview = self.client.get(url)
        self.assertEqual(preview.status_code, 200)
        response = self.client.post(
            url,
            {'impact_token': preview.json()['impact_token']},
            format='json',
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['name'], 'Nội dung & CV')
        self.assertTrue(response.json()['is_system_managed'])
        self.assertFalse(response.json()['is_active'])

    def test_restore_role_rejects_ui_records_and_busts_cache_only_for_permissions(self):
        custom_role = AdminRole.objects.create(
            department=self.department,
            code='custom',
            name='Custom',
        )
        self.authenticate(self.superuser)
        custom_response = self.client.get(
            reverse(
                'admin-role-restore-system-default',
                kwargs={'public_id': custom_role.public_id},
            )
        )
        self.assertEqual(custom_response.status_code, 400)

        management.call_command('sync_admin_permissions')
        definition = system_role_definition(self.department.code, self.role.code)
        defaults = AdminPermission.objects.filter(
            code__in=definition['permissions'],
            is_active=True,
        )
        self.role.permissions.set(defaults)
        self.role.name = 'Tên đã sửa'
        self.role.is_system_managed = False
        self.role.save(update_fields=['name', 'is_system_managed'])

        with patch(
            'apps.accounts.services.admin_access._schedule_cache_bust'
        ) as schedule_cache_bust:
            restore_system_role(self.role, actor=self.superuser)
        schedule_cache_bust.assert_not_called()

        self.role.refresh_from_db()
        self.assertEqual(self.role.name, definition['name'])
        self.assertTrue(self.role.is_system_managed)
        self.role.permissions.add(self.staff_permission)
        self.role.is_system_managed = False
        self.role.save(update_fields=['is_system_managed'])
        with patch(
            'apps.accounts.services.admin_access._schedule_cache_bust'
        ) as schedule_cache_bust:
            restore_system_role(self.role, actor=self.superuser)
        schedule_cache_bust.assert_called_once()

    def test_seed_preserves_custom_department_but_still_syncs_system_role(self):
        management.call_command('sync_admin_permissions')
        self.department.name = 'Phòng ban tuỳ chỉnh'
        self.department.is_system_managed = False
        self.department.save(update_fields=['name', 'is_system_managed'])
        self.role.name = 'Tên role cũ'
        self.role.is_system_managed = True
        self.role.save(update_fields=['name', 'is_system_managed'])

        management.call_command('seed_admin_access')

        self.department.refresh_from_db()
        self.role.refresh_from_db()
        self.assertEqual(self.department.name, 'Phòng ban tuỳ chỉnh')
        self.assertFalse(self.department.is_system_managed)
        self.assertEqual(self.role.name, 'Nhân viên')
        self.assertTrue(self.role.is_system_managed)

    def test_permission_token_is_bound_to_payload_and_resource(self):
        second_role = AdminRole.objects.create(
            department=self.department,
            code='manager',
            name='Trưởng phòng',
            rank=100,
        )
        second_role.permissions.add(self.business_permission)
        self.authenticate(self.superuser)
        impact_url = reverse(
            'admin-role-permissions-impact',
            kwargs={'public_id': self.role.public_id},
        )
        preview = self.client.post(
            impact_url,
            {'permission_codes': ['cv_template.view']},
            format='json',
        )
        token = preview.json()['impact_token']

        other_resource = self.client.put(
            reverse(
                'admin-role-permissions',
                kwargs={'public_id': second_role.public_id},
            ),
            {
                'permission_codes': ['cv_template.view'],
                'impact_token': token,
            },
            format='json',
        )
        self.assertEqual(other_resource.status_code, 409)

        changed_payload = self.client.put(
            reverse(
                'admin-role-permissions',
                kwargs={'public_id': self.role.public_id},
            ),
            {
                'permission_codes': ['admin_access.view', 'cv_template.view'],
                'impact_token': token,
            },
            format='json',
        )
        self.assertEqual(changed_payload.status_code, 409)

        bad_signature = self.client.put(
            reverse(
                'admin-role-permissions',
                kwargs={'public_id': self.role.public_id},
            ),
            {
                'permission_codes': ['cv_template.view'],
                'impact_token': f'{token}tampered',
            },
            format='json',
        )
        self.assertEqual(bad_signature.status_code, 400)
        self.assertIn('impact_token', bad_signature.json())

    def test_expired_token_and_assignment_resource_change_return_409(self):
        self.authenticate(self.superuser)
        impact_url = reverse(
            'admin-role-status-impact',
            kwargs={'public_id': self.role.public_id},
        )
        with patch('django.core.signing.time.time', return_value=1_000):
            preview = self.client.post(impact_url, {'is_active': False}, format='json')
        with patch('django.core.signing.time.time', return_value=1_601):
            expired = self.client.post(
                reverse(
                    'admin-role-deactivate',
                    kwargs={'public_id': self.role.public_id},
                ),
                {'impact_token': preview.json()['impact_token']},
                format='json',
            )
        self.assertEqual(expired.status_code, 409)
        self.assertEqual(expired.json()['code'], 'admin_resource_changed')

        second_role = AdminRole.objects.create(
            department=self.department,
            code='assignment-target',
            name='Assignment target',
        )
        second_role.permissions.add(self.business_permission)
        assignment = self.client.post(
            reverse('admin-membership-assignment-impact'),
            {
                'user_public_id': self.staff.public_id,
                'role_public_id': self.role.public_id,
            },
            format='json',
        )
        changed_resource = self.client.post(
            reverse('admin-membership-list'),
            {
                'user_public_id': self.staff.public_id,
                'role_public_id': second_role.public_id,
                'impact_token': assignment.json()['impact_token'],
            },
            format='json',
        )
        self.assertEqual(changed_resource.status_code, 409)

    def test_noop_does_not_stale_an_existing_impact_token(self):
        self.authenticate(self.superuser)
        permission_codes = sorted(
            self.role.permissions.filter(is_active=True).values_list('code', flat=True)
        )
        preview = self.client.post(
            reverse(
                'admin-role-permissions-impact',
                kwargs={'public_id': self.role.public_id},
            ),
            {'permission_codes': permission_codes},
            format='json',
        )
        revision = current_rbac_revision()
        noop = self.client.patch(
            reverse(
                'admin-department-detail',
                kwargs={'public_id': self.department.public_id},
            ),
            {'name': f'  {self.department.name}  '},
            format='json',
        )
        self.assertEqual(noop.status_code, 200)
        self.assertEqual(current_rbac_revision(), revision)

        confirmed = self.client.put(
            reverse(
                'admin-role-permissions',
                kwargs={'public_id': self.role.public_id},
            ),
            {
                'permission_codes': list(reversed(permission_codes)),
                'impact_token': preview.json()['impact_token'],
            },
            format='json',
        )
        self.assertEqual(confirmed.status_code, 200)
        self.assertEqual(current_rbac_revision(), revision)

    def test_preview_limit_and_query_count_are_flat(self):
        preview_department = Department.objects.create(code='preview-budget', name='Preview budget')
        preview_role = AdminRole.objects.create(
            department=preview_department,
            code='staff',
            name='Staff',
        )
        preview_role.permissions.add(self.business_permission)
        users = [
            User(
                public_id=generate_public_id('usr'),
                email=f'preview-{index}@example.com',
                role=User.Role.ADMIN,
                status=User.Status.ACTIVE,
            )
            for index in range(21)
        ]
        User.objects.bulk_create(users)
        AdminMembership.objects.bulk_create(
            [
                AdminMembership(
                    public_id=generate_public_id('amem'),
                    user=user,
                    role=preview_role,
                    is_primary=index == 0,
                    assigned_by=self.superuser,
                )
                for index, user in enumerate(users)
            ]
        )

        with CaptureQueriesContext(connection) as many_queries:
            preview = role_status_impact(preview_role, is_active=False)
        self.assertEqual(preview['affected_user_count'], 21)
        self.assertEqual(len(preview['affected_users_preview']), 20)
        self.assertTrue(preview['has_more'])

        AdminMembership.objects.filter(role=preview_role).exclude(user=users[0]).delete()
        with CaptureQueriesContext(connection) as one_query:
            role_status_impact(preview_role, is_active=False)
        self.assertEqual(len(many_queries), len(one_query))

    def test_membership_and_staff_list_query_counts_are_flat(self):
        self.authenticate(self.superuser)
        endpoints = [
            reverse('admin-membership-list'),
            reverse('admin-staff-list'),
        ]
        baseline_counts = []
        for endpoint in endpoints:
            with CaptureQueriesContext(connection) as queries:
                response = self.client.get(endpoint)
            self.assertEqual(response.status_code, 200)
            baseline_counts.append(len(queries))

        extra_users = [
            User(
                public_id=generate_public_id('usr'),
                email=f'list-budget-{index}@example.com',
                role=User.Role.ADMIN,
                status=User.Status.ACTIVE,
            )
            for index in range(8)
        ]
        User.objects.bulk_create(extra_users)
        AdminMembership.objects.bulk_create(
            [
                AdminMembership(
                    public_id=generate_public_id('amem'),
                    user=user,
                    role=self.role,
                    assigned_by=self.superuser,
                )
                for user in extra_users
            ]
        )

        for endpoint, baseline_count in zip(endpoints, baseline_counts, strict=True):
            with CaptureQueriesContext(connection) as queries:
                response = self.client.get(endpoint)
            self.assertEqual(response.status_code, 200)
            self.assertEqual(len(queries), baseline_count)

    def test_create_admin_user_is_non_privileged_and_secret_free(self):
        with patch(
            'apps.accounts.management.commands.create_admin_user.getpass.getpass',
            side_effect=['StrongPass123!', 'StrongPass123!'],
        ):
            management.call_command(
                'create_admin_user',
                'new-admin@example.com',
                actor_email=self.superuser.email,
            )
        user = User.objects.get(email='new-admin@example.com', role=User.Role.ADMIN)
        self.assertFalse(user.is_superuser)
        self.assertFalse(user.is_staff)
        audit = AdminAccessAuditLog.objects.get(
            action='create_admin_user',
            target_public_id=user.public_id,
        )
        self.assertNotIn('password', json.dumps(audit.payload).lower())
        with (
            patch(
                'apps.accounts.management.commands.create_admin_user.getpass.getpass',
                side_effect=['StrongPass123!', 'StrongPass123!'],
            ),
            self.assertRaises(CommandError),
        ):
            management.call_command('create_admin_user', 'NEW-ADMIN@example.com')


class AdminAccessRuleTests(TestCase):
    def test_migration_backfill_marks_only_the_system_matrix(self):
        system_department = Department.objects.create(code='content-cv', name='Content')
        custom_department = Department.objects.create(code='custom', name='Custom')
        system_role = AdminRole.objects.create(
            department=system_department,
            code='manager',
            name='Manager',
        )
        custom_code_role = AdminRole.objects.create(
            department=system_department,
            code='reviewer',
            name='Reviewer',
        )
        custom_department_role = AdminRole.objects.create(
            department=custom_department,
            code='manager',
            name='Custom manager',
        )
        migration = importlib.import_module(
            'apps.accounts.migrations.0014_admin_access_system_managed'
        )

        migration.mark_system_managed(django_apps, None)

        system_department.refresh_from_db()
        custom_department.refresh_from_db()
        system_role.refresh_from_db()
        custom_code_role.refresh_from_db()
        custom_department_role.refresh_from_db()
        self.assertTrue(system_department.is_system_managed)
        self.assertTrue(system_role.is_system_managed)
        self.assertFalse(custom_department.is_system_managed)
        self.assertFalse(custom_code_role.is_system_managed)
        self.assertFalse(custom_department_role.is_system_managed)

    def test_namespaced_superuser_requirement_never_falls_back_across_namespaces(self):
        permission = HasAdminPermission()
        action_view = SimpleNamespace(
            action='partial_update',
            require_superuser={
                'actions': {'partial_update'},
                'methods': {'POST'},
            },
        )
        self.assertTrue(
            permission._requires_superuser(
                SimpleNamespace(method='PATCH'),
                action_view,
            )
        )
        action_view.action = 'list'
        self.assertFalse(
            permission._requires_superuser(
                SimpleNamespace(method='POST'),
                action_view,
            )
        )

        method_view = SimpleNamespace(
            require_superuser={'methods': {'GET'}},
        )
        self.assertTrue(
            permission._requires_superuser(
                SimpleNamespace(method='HEAD'),
                method_view,
            )
        )
        self.assertFalse(
            permission._requires_superuser(
                SimpleNamespace(method='POST'),
                SimpleNamespace(require_superuser={'actions': {'create'}}),
            )
        )

    def test_only_one_active_membership_can_exist_for_a_user(self):
        department = Department.objects.create(code='ops', name='Ops')
        user = User.objects.create_user(
            'rules@example.com',
            'TestPass123',
            role=User.Role.ADMIN,
            status=User.Status.ACTIVE,
        )
        low = AdminRole.objects.create(
            department=department,
            code='low',
            name='Low',
            rank=10,
        )
        high = AdminRole.objects.create(
            department=department,
            code='high',
            name='High',
            rank=100,
        )
        AdminMembership.objects.create(user=user, role=low, is_primary=True)
        with self.assertRaises(IntegrityError), transaction.atomic():
            AdminMembership.objects.create(user=user, role=high, is_primary=True)

    def test_role_permission_service_noop_and_empty_invariant(self):
        actor = User.objects.create_user(
            'actor@example.com',
            'TestPass123',
            role=User.Role.ADMIN,
            status=User.Status.ACTIVE,
        )
        department = Department.objects.create(code='ops', name='Ops')
        role = AdminRole.objects.create(
            department=department,
            code='staff',
            name='Staff',
            is_system_managed=True,
        )
        permission = AdminPermission.objects.create(
            code='dashboard.view',
            module='dashboard',
            label='Dashboard',
        )
        role.permissions.add(permission)
        before = AdminAccessAuditLog.objects.count()
        set_role_permissions(
            role,
            ['dashboard.view', 'dashboard.view'],
            actor=actor,
            mark_customized=True,
        )
        role.refresh_from_db()
        self.assertTrue(role.is_system_managed)
        self.assertEqual(AdminAccessAuditLog.objects.count(), before)

        user = User.objects.create_user(
            'member@example.com',
            'TestPass123',
            role=User.Role.ADMIN,
            status=User.Status.ACTIVE,
        )
        assign_membership(user, role, actor=actor)
        with self.assertRaises(ValidationError):
            set_role_permissions(role, [], actor=actor, mark_customized=True)


class AdminAccessConcurrencyTests(TransactionTestCase):
    # Preserve data-migration fixtures and suppress post_migrate re-creation
    # between this row-locking suite and other serialized TransactionTestCases.
    serialized_rollback = True

    def test_two_role_replacements_leave_one_active_membership(self):
        actor = User.objects.create_user(
            'root-replacement@example.com',
            'TestPass123',
            role=User.Role.ADMIN,
            status=User.Status.ACTIVE,
            is_superuser=True,
        )
        employee = User.objects.create_user(
            'employee-replacement@example.com',
            'TestPass123',
            role=User.Role.ADMIN,
            status=User.Status.ACTIVE,
        )
        department = Department.objects.create(code='replacement', name='Replacement')
        old_role = AdminRole.objects.create(department=department, code='old', name='Old')
        new_role = AdminRole.objects.create(department=department, code='new', name='New')
        permission = AdminPermission.objects.create(
            code='replacement.view',
            module='replacement',
            label='Replacement',
        )
        old_role.permissions.add(permission)
        new_role.permissions.add(permission)
        old_membership = assign_membership(employee, old_role, actor=actor)
        token = membership_assignment_impact(employee, new_role)['impact_token']
        barrier = threading.Barrier(2)
        outcomes = []
        outcome_lock = threading.Lock()

        def run_confirmation():
            close_old_connections()
            local_employee = User.objects.get(pk=employee.pk)
            local_role = AdminRole.objects.get(pk=new_role.pk)
            local_actor = User.objects.get(pk=actor.pk)
            barrier.wait()
            try:
                confirm_membership_assignment(
                    local_employee,
                    local_role,
                    impact_token=token,
                    actor=local_actor,
                )
                outcome = 'committed'
            except StaleImpactToken:
                outcome = 'stale'
            finally:
                close_old_connections()
            with outcome_lock:
                outcomes.append(outcome)

        threads = [threading.Thread(target=run_confirmation) for _ in range(2)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(timeout=10)

        self.assertEqual(sorted(outcomes), ['committed', 'stale'])
        old_membership.refresh_from_db()
        self.assertFalse(old_membership.is_active)
        active = AdminMembership.objects.get(user=employee, is_active=True)
        self.assertEqual(active.role_id, new_role.pk)
        self.assertEqual(
            AdminAccessAuditLog.objects.filter(action='replace_membership').count(),
            1,
        )

    def test_two_confirmations_for_one_role_only_one_commits(self):
        actor = User.objects.create_user(
            'root-concurrency@example.com',
            'TestPass123',
            role=User.Role.ADMIN,
            status=User.Status.ACTIVE,
            is_superuser=True,
        )
        department = Department.objects.create(code='concurrency', name='Concurrency')
        role = AdminRole.objects.create(
            department=department,
            code='staff',
            name='Staff',
        )
        preview = role_status_impact(role, is_active=False)
        token = preview['impact_token']
        barrier = threading.Barrier(2)
        outcomes = []
        outcome_lock = threading.Lock()

        def run_confirmation():
            close_old_connections()
            local_role = AdminRole.objects.get(pk=role.pk)
            local_actor = User.objects.get(pk=actor.pk)
            barrier.wait()
            try:
                confirm_role_status_change(
                    local_role,
                    False,
                    impact_token=token,
                    actor=local_actor,
                )
                outcome = 'committed'
            except StaleImpactToken:
                outcome = 'stale'
            finally:
                close_old_connections()
            with outcome_lock:
                outcomes.append(outcome)

        threads = [threading.Thread(target=run_confirmation) for _ in range(2)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(timeout=10)

        self.assertEqual(sorted(outcomes), ['committed', 'stale'])
        role.refresh_from_db()
        self.assertFalse(role.is_active)
        self.assertEqual(
            AdminAccessAuditLog.objects.filter(action='set_role_active').count(),
            1,
        )

    def test_stale_revision_is_rejected_after_lock(self):
        actor = User.objects.create_user(
            'root-stale@example.com',
            'TestPass123',
            role=User.Role.ADMIN,
            status=User.Status.ACTIVE,
            is_superuser=True,
        )
        department = Department.objects.create(code='stale', name='Stale')
        role = AdminRole.objects.create(
            department=department,
            code='staff',
            name='Staff',
        )
        token = create_impact_token(
            revision=current_rbac_revision(),
            operation='role.status.change',
            resource_key=f'role:{role.public_id}',
            normalized_payload={'is_active': False},
        )
        AdminAccessAuditLog.objects.create(
            actor=actor,
            source='test',
            action='intervening_change',
            target_type='role',
            target_public_id=role.public_id,
            payload={},
        )
        with self.assertRaises(StaleImpactToken):
            confirm_role_status_change(
                role,
                False,
                impact_token=token,
                actor=actor,
            )
        role.refresh_from_db()
        self.assertTrue(role.is_active)
