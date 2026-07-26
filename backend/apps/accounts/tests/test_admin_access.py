import json
import re
from pathlib import Path
from tempfile import NamedTemporaryFile

from django.core import management
from django.core.exceptions import ValidationError
from django.core.management.base import CommandError
from django.db import IntegrityError, transaction
from django.test import TestCase, override_settings
from django.urls import path, reverse
from rest_framework.response import Response
from rest_framework.test import APIClient
from rest_framework.views import APIView

from apps.accounts.constants import ADMIN_PERMISSION_CODES
from apps.accounts.models import (
    AdminAccessAuditLog,
    AdminMembership,
    AdminPermission,
    AdminRole,
    Department,
    User,
)
from apps.accounts.permissions import HasAdminPermission
from apps.accounts.selectors import admin_access_snapshot, effective_permission_codes
from apps.accounts.services import (
    assign_membership,
    revoke_membership,
    set_department_active,
    set_role_permissions,
)


class ProtectedView(APIView):
    permission_classes = [HasAdminPermission]
    required_admin_permissions = {'GET': ['job_moderation.view']}

    def get(self, request):
        return Response({'ok': True})


class EmptyPermissionView(APIView):
    permission_classes = [HasAdminPermission]
    required_admin_permissions = []

    def get(self, request):
        return Response({'ok': True})


urlpatterns = [
    path('protected/', ProtectedView.as_view()),
    path('empty/', EmptyPermissionView.as_view()),
]


@override_settings(ROOT_URLCONF=__name__)
class AdminAccessTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            'admin@example.com',
            'TestPass123',
            role=User.Role.ADMIN,
            status=User.Status.ACTIVE,
        )
        self.other_admin = User.objects.create_user(
            'other-admin@example.com',
            'TestPass123',
            role=User.Role.ADMIN,
            status=User.Status.ACTIVE,
        )
        self.candidate = User.objects.create_user(
            'candidate@example.com',
            'TestPass123',
            role=User.Role.CANDIDATE,
            status=User.Status.ACTIVE,
        )
        self.department = Department.objects.create(
            code='job-moderation',
            name='Kiểm duyệt tin',
        )
        self.role = AdminRole.objects.create(
            department=self.department,
            code='staff',
            name='Nhân viên',
            rank=10,
        )
        self.permission = AdminPermission.objects.create(
            code='job_moderation.view',
            module='job_moderation',
            label='Xem tin',
        )
        self.role.permissions.add(self.permission)

    def assign(self, user=None, role=None, **kwargs):
        return assign_membership(
            user or self.admin,
            role or self.role,
            actor=self.other_admin,
            **kwargs,
        )

    def test_model_constraints_and_admin_validation(self):
        membership = AdminMembership(user=self.candidate, role=self.role)
        with self.assertRaises(ValidationError):
            membership.full_clean()

        self.assign()
        with self.assertRaises(IntegrityError), transaction.atomic():
            AdminMembership.objects.create(user=self.admin, role=self.role)

        revoked = AdminMembership.objects.get(user=self.admin)
        revoke_membership(revoked, actor=self.other_admin)
        replacement = self.assign()
        self.assertNotEqual(revoked.public_id, replacement.public_id)

    def test_effective_permissions_filter_every_active_layer(self):
        membership = self.assign()
        self.assertEqual(
            effective_permission_codes(self.admin),
            frozenset({'job_moderation.view'}),
        )
        self.assertEqual(effective_permission_codes(self.candidate), frozenset())

        self.role.is_active = False
        self.role.save(update_fields=['is_active'])
        from apps.accounts.admin_access_cache import bust_admin_permission_cache

        bust_admin_permission_cache({self.admin.pk})
        self.assertEqual(effective_permission_codes(self.admin), frozenset())

        self.role.is_active = True
        self.role.save(update_fields=['is_active'])
        membership.is_active = False
        membership.save(update_fields=['is_active'])
        bust_admin_permission_cache({self.admin.pk})
        self.assertEqual(effective_permission_codes(self.admin), frozenset())

    def test_superuser_bypasses_to_the_code_registry(self):
        self.admin.is_superuser = True
        self.admin.save(update_fields=['is_superuser'])
        self.assertEqual(effective_permission_codes(self.admin), ADMIN_PERMISSION_CODES)

    def test_assign_replaces_the_active_membership(self):
        first = self.assign()
        self.assertTrue(first.is_primary)
        manager = AdminRole.objects.create(
            department=self.department,
            code='manager',
            name='Trưởng phòng',
            rank=100,
        )
        manager.permissions.add(self.permission)
        second = self.assign(role=manager)
        first.refresh_from_db()
        second.refresh_from_db()
        self.assertFalse(first.is_active)
        self.assertFalse(first.is_primary)
        self.assertTrue(second.is_primary)
        self.assertEqual(
            AdminMembership.objects.filter(user=self.admin, is_active=True).count(),
            1,
        )

    def test_snapshot_excludes_inactive_memberships_and_sorts_permissions(self):
        self.assign()
        extra = AdminPermission.objects.create(
            code='job_moderation.approve',
            module='job_moderation',
            label='Duyệt tin',
        )
        self.role.permissions.add(extra)
        snapshot = admin_access_snapshot(self.admin)
        self.assertEqual(
            snapshot['permissions'],
            ['job_moderation.approve', 'job_moderation.view'],
        )
        self.assertEqual(snapshot['primary_department']['code'], 'job-moderation')

        set_department_active(self.department, False, actor=self.other_admin)
        snapshot = admin_access_snapshot(self.admin)
        self.assertEqual(snapshot['memberships'], [])
        self.assertIsNone(snapshot['primary_department'])

    def test_role_permission_sync_preserves_deprecated_grants_and_noops(self):
        self.assign()
        deprecated = AdminPermission.objects.create(
            code='job_moderation.reject',
            module='job_moderation',
            label='Từ chối',
            is_active=False,
        )
        self.role.permissions.add(deprecated)
        before_audits = AdminAccessAuditLog.objects.count()
        set_role_permissions(
            self.role,
            {'job_moderation.view'},
            actor=self.other_admin,
        )
        self.assertTrue(self.role.permissions.filter(pk=deprecated.pk).exists())
        self.assertEqual(AdminAccessAuditLog.objects.count(), before_audits)

        with self.assertRaises(ValidationError):
            set_role_permissions(
                self.role,
                {'job_moderation.reject'},
                actor=self.other_admin,
            )

    def test_audit_uses_public_identifiers(self):
        membership = self.assign()
        audit = AdminAccessAuditLog.objects.get(action='assign_membership')
        self.assertEqual(audit.target_public_id, membership.public_id)
        serialized = json.dumps(audit.payload)
        self.assertIn(self.admin.public_id, serialized)
        self.assertNotIn(f'"{self.admin.pk}"', serialized)

    def test_permission_denial_has_stable_json_contract(self):
        client = APIClient()
        client.force_authenticate(self.admin)
        response = client.get('/protected/')
        self.assertEqual(response.status_code, 403)
        self.assertEqual(
            response.json(),
            {
                'code': 'admin_permission_denied',
                'message': 'Bạn không có quyền thực hiện hành động này.',
            },
        )

        with self.captureOnCommitCallbacks(execute=True):
            self.assign()
        response = client.get('/protected/')
        self.assertEqual(response.status_code, 200)

    def test_empty_permission_declaration_fails_closed(self):
        client = APIClient()
        client.force_authenticate(self.admin)
        response = client.get('/empty/')
        self.assertEqual(response.status_code, 403)

    def test_export_command_uses_registry_without_database_reads(self):
        with NamedTemporaryFile(suffix='.json') as output:
            management.call_command('export_admin_permissions', output=output.name)
            payload = json.loads(Path(output.name).read_text(encoding='utf-8'))
        self.assertEqual(
            [item['code'] for item in payload],
            sorted(ADMIN_PERMISSION_CODES),
        )

    def test_bootstrap_admin_mfa_is_atomic_and_secret_free(self):
        with self.assertRaises(CommandError):
            management.call_command(
                'bootstrap_admin_mfa',
                self.admin.email,
                no_input=True,
            )
        self.admin.refresh_from_db()
        self.assertFalse(self.admin.email_verified)
        self.assertFalse(self.admin.two_factor_enabled)

        management.call_command(
            'bootstrap_admin_mfa',
            self.admin.email,
            mark_email_verified=True,
            actor_email=self.other_admin.email,
            no_input=True,
        )
        self.admin.refresh_from_db()
        self.assertTrue(self.admin.email_verified)
        self.assertTrue(self.admin.two_factor_enabled)
        self.assertTrue(self.admin.two_factor_email_enabled)
        audits = AdminAccessAuditLog.objects.filter(target_public_id=self.admin.public_id).order_by(
            'created_at'
        )
        self.assertEqual(
            list(audits.values_list('action', flat=True)),
            ['mark_email_verified', 'bootstrap_mfa'],
        )
        payload = json.dumps(list(audits.values_list('payload', flat=True)))
        for forbidden in ('otp', 'totp', 'secret', 'backup', 'token', 'password'):
            self.assertNotIn(forbidden, payload.lower())

    def test_registry_codes_follow_the_stable_format(self):
        for code in ADMIN_PERMISSION_CODES:
            self.assertRegex(code, re.compile(r'^[a-z_]+\.[a-z_]+$'))

    def test_every_declared_view_permission_exists_in_the_registry(self):
        from apps.accounts.api.views.admin_access import (
            AdminDepartmentViewSet,
            AdminMembershipViewSet,
            AdminPermissionViewSet,
            AdminRoleViewSet,
            AdminStaffViewSet,
        )
        from apps.cv_templates.api.views import admin as cv_admin
        from apps.jobs.api.views.moderation import (
            AdminJobModerationListView,
            AdminJobReviewView,
        )
        from apps.services.api.views import catalog as service_catalog
        from apps.sitecontent.api.views import settings as site_settings

        view_classes = [
            cv_admin.AdminModelViewSet,
            cv_admin.AdminCvTemplateViewSet,
            cv_admin.AdminCvSampleContentViewSet,
            cv_admin.AdminCvContentBlueprintViewSet,
            service_catalog.AdminServiceCategoryListCreateView,
            service_catalog.AdminServiceCategoryDetailView,
            service_catalog.AdminServicePackageListCreateView,
            service_catalog.AdminServicePackageDetailView,
            service_catalog.AdminConsultationLeadListView,
            service_catalog.AdminConsultationLeadDetailView,
            site_settings.AdminLocaleListCreateView,
            site_settings.AdminLocaleDetailView,
            site_settings.AdminSiteSettingView,
            site_settings.AdminSettingUploadView,
            AdminJobModerationListView,
            AdminJobReviewView,
            AdminDepartmentViewSet,
            AdminRoleViewSet,
            AdminPermissionViewSet,
            AdminMembershipViewSet,
            AdminStaffViewSet,
        ]
        declared = set()
        for view_class in view_classes:
            required = view_class.required_admin_permissions
            values = required.values() if isinstance(required, dict) else [required]
            for codes in values:
                declared.update(codes)
        self.assertEqual(declared - ADMIN_PERMISSION_CODES, set())


class AdminSiteSettingRbacTests(TestCase):
    def test_site_settings_are_superuser_only_even_with_permission(self):
        admin = User.objects.create_user(
            'settings-admin@example.com',
            'TestPass123',
            role=User.Role.ADMIN,
            status=User.Status.ACTIVE,
        )
        department = Department.objects.create(code='ops', name='Ops')
        role = AdminRole.objects.create(department=department, code='staff', name='Staff')
        permission = AdminPermission.objects.create(
            code='site_setting.view',
            module='site_setting',
            label='Xem cài đặt',
        )
        role.permissions.add(permission)
        assign_membership(admin, role, actor=admin)

        client = APIClient()
        client.force_authenticate(admin)
        response = client.get(reverse('site-admin-settings'))
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()['code'], 'admin_permission_denied')

        admin.is_superuser = True
        admin.save(update_fields=['is_superuser'])
        response = client.get(reverse('site-admin-settings'))
        self.assertEqual(response.status_code, 200)
