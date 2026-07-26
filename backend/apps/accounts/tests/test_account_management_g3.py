import threading
from io import StringIO
from unittest import skipUnless
from unittest.mock import patch

from django.contrib.auth.hashers import check_password
from django.core import management
from django.db import close_old_connections, connection
from django.test import TestCase, TransactionTestCase
from django.test.utils import CaptureQueriesContext
from django.urls import reverse
from rest_framework.test import APIClient

from apps.accounts.admin_invitation_tokens import create_admin_invitation_token
from apps.accounts.models import (
    AdminAccessAuditLog,
    AdminInvitation,
    AdminMembership,
    AdminPermission,
    AdminProvisioningScope,
    AdminRole,
    AuthEmailJob,
    Department,
    User,
)
from apps.accounts.selectors import account_status_impact
from apps.accounts.services import (
    accept_admin_invitation,
    assign_membership,
    confirm_account_status,
    create_admin_invitation,
    create_provisioning_scope,
)
from apps.employers.models import (
    CampaignActivity,
    Company,
    RecruiterProfile,
    RecruitmentCampaign,
)


class AccountManagementG3ApiTests(TestCase):
    password = 'StrongPass123'

    def setUp(self):
        self.delay = patch('apps.accounts.tasks.auth_email.deliver_auth_email_job.delay').start()
        self.addCleanup(patch.stopall)
        self.superuser = User.objects.create_user(
            'root-g3@example.com',
            self.password,
            role=User.Role.ADMIN,
            status=User.Status.ACTIVE,
            is_active=True,
            is_staff=True,
            is_superuser=True,
        )
        self.provisioner = User.objects.create_user(
            'hr@example.com',
            self.password,
            role=User.Role.ADMIN,
            status=User.Status.ACTIVE,
            is_active=True,
        )
        self.other_provisioner = User.objects.create_user(
            'hr-other@example.com',
            self.password,
            role=User.Role.ADMIN,
            status=User.Status.ACTIVE,
            is_active=True,
        )
        self.department = Department.objects.create(code='people', name='Nhân sự')
        self.invite_permission, _ = AdminPermission.objects.get_or_create(
            code='account.admin.invite',
            defaults={'module': 'account', 'label': 'Mời Admin'},
        )
        self.manage_permission, _ = AdminPermission.objects.get_or_create(
            code='account.admin.manage',
            defaults={'module': 'account', 'label': 'Quản lý Admin'},
        )
        self.view_permission, _ = AdminPermission.objects.get_or_create(
            code='account.view',
            defaults={'module': 'account', 'label': 'Xem tài khoản'},
        )
        self.business_permission, _ = AdminPermission.objects.get_or_create(
            code='job_moderation.view',
            defaults={'module': 'job_moderation', 'label': 'Xem tin'},
        )
        self.source_role = AdminRole.objects.create(
            department=self.department,
            code='internal-hr',
            name='Nhân sự nội bộ',
        )
        self.source_role.permissions.add(self.invite_permission)
        self.target_role = AdminRole.objects.create(
            department=self.department,
            code='moderator',
            name='Nhân viên kiểm duyệt',
        )
        self.target_role.permissions.add(self.business_permission)
        self.forbidden_role = AdminRole.objects.create(
            department=self.department,
            code='provisioner',
            name='Nhân viên cấp phát',
        )
        self.forbidden_role.permissions.add(
            self.business_permission,
            self.invite_permission,
        )
        assign_membership(self.provisioner, self.source_role, actor=self.superuser)
        assign_membership(self.other_provisioner, self.source_role, actor=self.superuser)
        self.scope = create_provisioning_scope(
            source_role=self.source_role,
            target_role=self.target_role,
            actor=self.superuser,
        )
        self.client = APIClient()

    def authenticate(self, user):
        self.client.force_authenticate(user)

    def test_admin_detail_returns_complete_effective_access(self):
        self.authenticate(self.superuser)

        response = self.client.get(
            reverse('admin-account-detail', kwargs={'public_id': self.provisioner.public_id})
        )

        self.assertEqual(response.status_code, 200)
        access = response.json()['admin_access']
        self.assertEqual(access['access_source'], 'role')
        self.assertEqual(access['permissions'], ['account.admin.invite'])
        self.assertEqual(access['permission_count'], 1)
        self.assertFalse(access['is_superuser'])
        self.assertTrue(access['membership']['is_active'])
        self.assertTrue(access['membership']['is_primary'])
        self.assertEqual(access['membership']['assigned_by_email'], self.superuser.email)
        self.assertEqual(access['membership']['assigned_by_name'], self.superuser.full_name)
        self.assertEqual(access['membership']['role']['code'], self.source_role.code)
        self.assertEqual(
            access['membership']['role']['department']['code'],
            self.department.code,
        )

    def test_locking_employer_pauses_only_their_active_campaigns(self):
        employer = User.objects.create_user(
            'campaign-owner@example.com',
            self.password,
            role=User.Role.EMPLOYER,
        )
        company = Company.objects.create(company_name='Campaign owner', created_by=employer)
        recruiter = RecruiterProfile.objects.create(user=employer, company=company)
        active_campaign = RecruitmentCampaign.objects.create(
            owner=recruiter,
            company=company,
            name='Active campaign',
            status=RecruitmentCampaign.Status.ACTIVE,
        )
        completed_campaign = RecruitmentCampaign.objects.create(
            owner=recruiter,
            company=company,
            name='Completed campaign',
            status=RecruitmentCampaign.Status.COMPLETED,
        )
        impact = account_status_impact(
            employer,
            status=User.Status.BANNED,
            reason='Vi phạm chính sách.',
        )

        confirm_account_status(
            employer,
            status=User.Status.BANNED,
            reason='Vi phạm chính sách.',
            impact_token=impact['impact_token'],
            actor=self.superuser,
        )

        active_campaign.refresh_from_db()
        completed_campaign.refresh_from_db()
        self.assertEqual(active_campaign.status, RecruitmentCampaign.Status.PAUSED)
        self.assertEqual(completed_campaign.status, RecruitmentCampaign.Status.COMPLETED)
        self.assertTrue(
            CampaignActivity.objects.filter(
                campaign=active_campaign,
                event_type=CampaignActivity.EventType.CAMPAIGN_PAUSED,
                actor=self.superuser,
                metadata={'reason': 'employer_account_locked'},
            ).exists()
        )

    def invite(self, *, email='new-admin@example.com', actor=None):
        self.authenticate(actor or self.provisioner)
        return self.client.post(
            reverse('admin-account-invitation-list'),
            {
                'email': email,
                'full_name': 'Nhân viên mới',
                'target_role_public_id': self.target_role.public_id,
                'reason': 'Bổ sung nhân sự kiểm duyệt ca tối',
            },
            format='json',
        )

    def test_available_roles_and_server_side_whitelist_are_fail_closed(self):
        self.authenticate(self.provisioner)
        response = self.client.get(reverse('admin-account-invitation-available-roles'))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            [item['public_id'] for item in response.json()],
            [self.target_role.public_id],
        )

        forged = self.client.post(
            reverse('admin-account-invitation-list'),
            {
                'email': 'forged@example.com',
                'full_name': 'Request giả mạo',
                'target_role_public_id': self.forbidden_role.public_id,
                'reason': 'Thử vượt whitelist',
            },
            format='json',
        )
        self.assertEqual(forged.status_code, 403)
        self.assertEqual(forged.json()['code'], 'admin_permission_denied')
        self.assertFalse(
            User.objects.filter(email='forged@example.com', role=User.Role.ADMIN).exists()
        )

    def test_invite_permission_without_an_active_scope_cannot_invite(self):
        self.scope.delete()

        response = self.invite(email='no-scope@example.com')

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()['code'], 'admin_permission_denied')
        self.assertFalse(
            User.objects.filter(email='no-scope@example.com', role=User.Role.ADMIN).exists()
        )

    def test_sensitive_target_is_rejected_even_if_scope_is_injected(self):
        AdminProvisioningScope.objects.create(
            source_role=self.source_role,
            target_role=self.forbidden_role,
            configured_by=self.superuser,
        )
        self.authenticate(self.provisioner)

        response = self.client.post(
            reverse('admin-account-invitation-list'),
            {
                'email': 'sensitive@example.com',
                'full_name': 'Yêu cầu nhạy cảm',
                'target_role_public_id': self.forbidden_role.public_id,
                'reason': 'Thử cấp chức danh có quyền cấp phát',
            },
            format='json',
        )

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()['code'], 'admin_permission_denied')
        self.assertFalse(
            User.objects.filter(email='sensitive@example.com', role=User.Role.ADMIN).exists()
        )

    def test_candidate_email_can_have_a_separate_pending_admin_account(self):
        User.objects.create_user(
            'same@example.com',
            self.password,
            role=User.Role.CANDIDATE,
            status=User.Status.ACTIVE,
        )
        response = self.invite(email='same@example.com')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(
            User.objects.filter(email='same@example.com').values_list('role', flat=True).count(),
            2,
        )
        pending = User.objects.get(email='same@example.com', role=User.Role.ADMIN)
        self.assertEqual(pending.status, User.Status.PENDING)
        self.assertFalse(pending.is_active)
        self.assertFalse(pending.has_usable_password())
        self.assertTrue(
            AuthEmailJob.objects.filter(
                user=pending,
                kind=AuthEmailJob.Kind.ADMIN_INVITATION,
            ).exists()
        )

    def test_provisioners_only_see_and_manage_their_own_invitations(self):
        first = self.invite().json()
        invitation = AdminInvitation.objects.get(public_id=first['public_id'])
        create_admin_invitation(
            email='other-invite@example.com',
            full_name='Người của HR khác',
            target_role=self.target_role,
            reason='Nhu cầu ca sáng',
            actor=self.other_provisioner,
        )

        self.authenticate(self.provisioner)
        listing = self.client.get(reverse('admin-account-invitation-list'))
        self.assertEqual(listing.status_code, 200)
        self.assertEqual(listing.json()['count'], 1)
        self.assertEqual(listing.json()['results'][0]['public_id'], invitation.public_id)

        other = AdminInvitation.objects.get(invited_by=self.other_provisioner)
        hidden = self.client.post(
            reverse(
                'admin-account-invitation-resend',
                kwargs={'public_id': other.public_id},
            ),
            format='json',
        )
        self.assertEqual(hidden.status_code, 404)

    def test_resend_invalidates_old_link_and_accept_only_requires_a_password(self):
        response = self.invite()
        invitation = AdminInvitation.objects.get(public_id=response.json()['public_id'])
        old_token = create_admin_invitation_token(invitation)

        self.authenticate(self.provisioner)
        resend = self.client.post(
            reverse(
                'admin-account-invitation-resend',
                kwargs={'public_id': invitation.public_id},
            ),
            format='json',
        )
        self.assertEqual(resend.status_code, 200)
        invalid = APIClient().get(
            reverse('auth-admin-invitation-validate'),
            {'token': old_token},
        )
        self.assertEqual(invalid.status_code, 400)

        invitation.refresh_from_db()
        token = create_admin_invitation_token(invitation)
        accepted = APIClient().post(
            reverse('auth-admin-invitation-accept'),
            {
                'token': token,
                'password': self.password,
                'password_confirm': self.password,
            },
            format='json',
        )
        self.assertEqual(accepted.status_code, 200)
        self.assertNotIn('backup_codes', accepted.json())

        invitation.refresh_from_db()
        user = invitation.user
        user.refresh_from_db()
        self.assertEqual(invitation.status, AdminInvitation.Status.ACCEPTED)
        self.assertEqual(user.status, User.Status.ACTIVE)
        self.assertTrue(user.email_verified)
        self.assertFalse(user.two_factor_enabled)
        self.assertFalse(user.two_factor_email_enabled)
        self.assertFalse(user.two_factor_backup_code_hashes)
        self.assertEqual(AdminMembership.objects.filter(user=user, is_active=True).count(), 1)

        second = APIClient().post(
            reverse('auth-admin-invitation-accept'),
            {
                'token': token,
                'password': self.password,
                'password_confirm': self.password,
            },
            format='json',
        )
        self.assertEqual(second.status_code, 400)

    def test_scope_deactivation_revokes_pending_invitations_atomically(self):
        response = self.invite()
        invitation = AdminInvitation.objects.get(public_id=response.json()['public_id'])
        self.authenticate(self.superuser)
        impact = self.client.post(
            reverse(
                'admin-provisioning-scope-status-impact',
                kwargs={'public_id': self.scope.public_id},
            ),
            {'is_active': False},
            format='json',
        )
        self.assertEqual(impact.status_code, 200)
        self.assertEqual(impact.json()['pending_invitation_count'], 1)

        deactivated = self.client.post(
            reverse(
                'admin-provisioning-scope-deactivate',
                kwargs={'public_id': self.scope.public_id},
            ),
            {'impact_token': impact.json()['impact_token']},
            format='json',
        )
        self.assertEqual(deactivated.status_code, 200)
        invitation.refresh_from_db()
        self.scope.refresh_from_db()
        self.assertFalse(self.scope.is_active)
        self.assertEqual(invitation.status, AdminInvitation.Status.REVOKED)

    def test_account_list_query_count_stays_flat(self):
        self.authenticate(self.superuser)
        url = reverse('admin-account-list')
        with CaptureQueriesContext(connection) as baseline:
            response = self.client.get(url)
            self.assertEqual(response.status_code, 200)
            list(response.data['results'])
        for index in range(12):
            User.objects.create_user(
                f'candidate-{index}@example.com',
                self.password,
                role=User.Role.CANDIDATE,
                status=User.Status.ACTIVE,
            )
        with CaptureQueriesContext(connection) as expanded:
            response = self.client.get(url)
            self.assertEqual(response.status_code, 200)
            list(response.data['results'])
        self.assertLessEqual(len(expanded), len(baseline) + 1)

    def test_superuser_cannot_send_password_reset_to_locked_admin(self):
        locked_admin = User.objects.create_user(
            'locked-admin@example.com',
            self.password,
            role=User.Role.ADMIN,
            status=User.Status.BANNED,
            is_active=False,
        )
        assign_membership(locked_admin, self.target_role, actor=self.superuser)
        self.authenticate(self.superuser)

        response = self.client.post(
            reverse(
                'admin-account-send-password-reset',
                kwargs={'public_id': locked_admin.public_id},
            ),
            format='json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn('đang hoạt động', str(response.data))
        self.assertFalse(
            AuthEmailJob.objects.filter(
                user=locked_admin,
                kind=AuthEmailJob.Kind.PASSWORD_RESET,
            ).exists()
        )

    def test_audit_does_not_contain_the_invitation_token(self):
        response = self.invite()
        invitation = AdminInvitation.objects.get(public_id=response.json()['public_id'])
        token = create_admin_invitation_token(invitation)
        accept_admin_invitation(token=token, password=self.password)
        audit_blob = str(
            list(
                AdminAccessAuditLog.objects.values_list(
                    'action',
                    'payload',
                )
            )
        )
        self.assertNotIn(token, audit_blob)


class AccountManagementG3DemoSeedTests(TestCase):
    def test_demo_seed_is_idempotent_and_provides_login_backup_codes(self):
        output = StringIO()
        management.call_command('seed_admin_account_demo', force=True, stdout=output)
        management.call_command('seed_admin_account_demo', force=True, stdout=output)

        admins = User.objects.filter(
            email__in=[
                'admin-root@demo.local',
                'hr-provisioner@demo.local',
                'moderator-admin@demo.local',
            ],
            role=User.Role.ADMIN,
        )
        self.assertEqual(admins.count(), 3)
        self.assertEqual(
            AdminMembership.objects.filter(user__in=admins, is_active=True).count(),
            2,
        )
        self.assertEqual(AdminProvisioningScope.objects.filter(is_active=True).count(), 3)
        root = admins.get(email='admin-root@demo.local')
        self.assertTrue(root.check_password('AdminDemo123!'))
        self.assertTrue(
            any(check_password('91000001', value) for value in root.two_factor_backup_code_hashes)
        )
        self.assertIn('91000001', output.getvalue())


@skipUnless(connection.features.has_select_for_update, 'Requires row-level locking support.')
class AccountInvitationConcurrencyTests(TransactionTestCase):
    # Keep the test database's data-migration snapshot consistent with the
    # other row-locking TransactionTestCases in this app. A non-serialized
    # flush between them recreates content types before Django restores its
    # snapshot and causes duplicate fixtures in the following suite.
    serialized_rollback = True
    password = 'StrongPass123'

    def setUp(self):
        self.delay = patch('apps.accounts.tasks.auth_email.deliver_auth_email_job.delay').start()
        self.addCleanup(patch.stopall)
        root = User.objects.create_user(
            'concurrency-root@example.com',
            self.password,
            role=User.Role.ADMIN,
            status=User.Status.ACTIVE,
            is_active=True,
            is_superuser=True,
            is_staff=True,
        )
        department = Department.objects.create(code='concurrency', name='Concurrency')
        permission, _ = AdminPermission.objects.get_or_create(
            code='job_moderation.view',
            defaults={'module': 'job_moderation', 'label': 'Xem tin'},
        )
        role = AdminRole.objects.create(
            department=department,
            code='moderator',
            name='Kiểm duyệt',
        )
        role.permissions.add(permission)
        invitation = create_admin_invitation(
            email='race@example.com',
            full_name='Concurrent Admin',
            target_role=role,
            reason='Kiểm tra chống chấp nhận trùng',
            actor=root,
        )
        self.user_id = invitation.user_id
        self.token = create_admin_invitation_token(invitation)

    def test_concurrent_accept_creates_exactly_one_membership(self):
        barrier = threading.Barrier(2)
        outcomes = []

        def accept():
            close_old_connections()
            try:
                barrier.wait(timeout=5)
                accept_admin_invitation(token=self.token, password=self.password)
            except Exception as error:  # noqa: BLE001 - competing request must fail
                outcomes.append(type(error).__name__)
            else:
                outcomes.append('accepted')
            finally:
                close_old_connections()

        threads = [threading.Thread(target=accept) for _ in range(2)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(timeout=10)

        self.assertEqual(outcomes.count('accepted'), 1)
        self.assertEqual(AdminMembership.objects.filter(user_id=self.user_id).count(), 1)
