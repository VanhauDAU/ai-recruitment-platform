import threading
from io import StringIO
from types import SimpleNamespace
from unittest import skipUnless
from unittest.mock import patch

from django.core import management
from django.db import close_old_connections, connection
from django.test import TestCase, TransactionTestCase, override_settings
from django.test.utils import CaptureQueriesContext
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient, APIRequestFactory

from apps.accounts.api.permissions import AdminPortalPermission
from apps.accounts.models import AdminAccessAuditLog, AdminInvitation, AuthEmailJob, User
from apps.accounts.selectors import account_status_impact
from apps.accounts.services import (
    accept_admin_invitation,
    confirm_account_status,
    create_admin_invitation,
)
from apps.accounts.services.admin_invitation_tokens import create_admin_invitation_token
from apps.accounts.services.exceptions import AdminPermissionDenied
from apps.accounts.tests.factories import make_admin
from apps.campaigns.models import CampaignActivity, RecruitmentCampaign
from apps.employers.models import (
    Company,
    EmployerVerificationCase,
    RecruiterProfile,
    RecruitmentNeed,
)
from apps.jobs.models import JobCategory


class AccountManagementG3ApiTests(TestCase):
    password = 'StrongPass123'

    def setUp(self):
        self.delay = patch('apps.accounts.tasks.auth_email.deliver_auth_email_job.delay').start()
        self.addCleanup(patch.stopall)
        self.superuser = make_admin('root-g3@example.com', superuser=True, password=self.password)
        self.regular_admin = make_admin('hr@example.com', password=self.password)
        self.client = APIClient()

    def authenticate(self, user):
        self.client.force_authenticate(user)

    def test_admin_detail_exposes_admin_tier(self):
        self.authenticate(self.superuser)

        response = self.client.get(
            reverse('admin-account-detail', kwargs={'public_id': self.regular_admin.public_id})
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['admin_access'], {'is_superuser': False})

    def test_me_exposes_admin_tier_only_for_admins(self):
        candidate = User.objects.create_user(
            'me-candidate@example.com', self.password, role=User.Role.CANDIDATE
        )
        for user, expected in (
            (self.superuser, {'is_superuser': True}),
            (self.regular_admin, {'is_superuser': False}),
            (candidate, None),
        ):
            self.authenticate(user)
            response = self.client.get(reverse('auth-me'))
            self.assertEqual(response.status_code, 200, response.data)
            self.assertEqual(response.json()['admin_access'], expected)

    def test_account_detail_resolves_stored_avatar_path(self):
        employer = User.objects.create_user(
            'avatar-employer@example.com',
            self.password,
            role=User.Role.EMPLOYER,
            status=User.Status.ACTIVE,
            avatar_url='users/avatars/recruiter.png',
        )
        self.authenticate(self.superuser)

        response = self.client.get(
            reverse('admin-account-detail', kwargs={'public_id': employer.public_id})
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json()['avatar_url'],
            'http://testserver/media/users/avatars/recruiter.png',
        )

    def test_regular_admin_only_sees_candidate_and_employer_accounts(self):
        candidate = User.objects.create_user(
            'candidate-scope@example.com',
            self.password,
            role=User.Role.CANDIDATE,
        )
        employer = User.objects.create_user(
            'employer-scope@example.com',
            self.password,
            role=User.Role.EMPLOYER,
        )
        self.authenticate(self.regular_admin)

        response = self.client.get(reverse('admin-account-list'))

        self.assertEqual(response.status_code, 200, response.data)
        self.assertCountEqual(
            [item['public_id'] for item in response.json()['results']],
            [candidate.public_id, employer.public_id],
        )
        self.assertEqual(
            self.client.get(
                reverse('admin-account-detail', kwargs={'public_id': self.superuser.public_id})
            ).status_code,
            404,
        )

        self.authenticate(self.superuser)
        listed = self.client.get(reverse('admin-account-list'))
        self.assertIn(
            self.regular_admin.public_id,
            [item['public_id'] for item in listed.json()['results']],
        )

    def test_explicit_account_scopes_separate_users_and_recruiters(self):
        candidate = User.objects.create_user(
            'scoped-candidate@example.com',
            self.password,
            role=User.Role.CANDIDATE,
            status=User.Status.ACTIVE,
        )
        employer = User.objects.create_user(
            'scoped-employer@example.com',
            self.password,
            role=User.Role.EMPLOYER,
            status=User.Status.ACTIVE,
        )
        self.authenticate(self.superuser)

        users = self.client.get(reverse('admin-account-list'), {'scope': 'users'})
        recruiters = self.client.get(
            reverse('admin-account-list'),
            {'scope': 'recruiters'},
        )

        self.assertEqual(users.status_code, 200, users.data)
        self.assertIn(candidate.public_id, [item['public_id'] for item in users.data['results']])
        self.assertNotIn(employer.public_id, [item['public_id'] for item in users.data['results']])
        self.assertEqual(recruiters.status_code, 200, recruiters.data)
        self.assertEqual(
            [item['public_id'] for item in recruiters.data['results']],
            [employer.public_id],
        )

    def test_account_scope_rejects_incompatible_role_and_invalid_status(self):
        self.authenticate(self.superuser)

        incompatible = self.client.get(
            reverse('admin-account-list'),
            {'scope': 'users', 'role': User.Role.EMPLOYER},
        )
        invalid_status = self.client.get(
            reverse('admin-account-list'),
            {'scope': 'users', 'status': 'active,unknown'},
        )

        self.assertEqual(incompatible.status_code, 400)
        self.assertEqual(invalid_status.status_code, 400)

    def test_scoped_summaries_use_full_scope_and_live_pending_invitations(self):
        User.objects.create_user(
            'summary-candidate@example.com',
            self.password,
            role=User.Role.CANDIDATE,
            status=User.Status.BANNED,
            email_verified=False,
        )
        linked_user = User.objects.create_user(
            'summary-linked@example.com',
            self.password,
            role=User.Role.EMPLOYER,
            status=User.Status.ACTIVE,
            email_verified=True,
        )
        missing_user = User.objects.create_user(
            'summary-missing@example.com',
            self.password,
            role=User.Role.EMPLOYER,
            status=User.Status.INACTIVE,
        )
        company = Company.objects.create(
            company_name='Summary company',
            created_by=linked_user,
        )
        recruiter = RecruiterProfile.objects.create(
            user=linked_user,
            company=company,
            registration_completed_at=timezone.now(),
        )
        RecruiterProfile.objects.create(user=missing_user)
        EmployerVerificationCase.objects.create(
            recruiter=recruiter,
            company=company,
            status=EmployerVerificationCase.Status.APPROVED,
        )
        category = JobCategory.objects.create(
            name='Nhu cầu cho thống kê tài khoản',
            category_type=JobCategory.CategoryType.SPECIALIZATION,
        )
        RecruitmentNeed.objects.create(
            recruiter=recruiter,
            position_category=category,
            position_level=RecruitmentNeed.PositionLevel.EMPLOYEE,
            budget_source=RecruitmentNeed.BudgetSource.COMPANY,
            completed_at=timezone.now(),
        )
        invitation = self.invite(email='summary-invited@example.com')
        self.assertEqual(invitation.status_code, 201)
        self.authenticate(self.superuser)

        users = self.client.get(
            reverse('admin-account-summary'),
            {'scope': 'users'},
        )
        recruiters = self.client.get(
            reverse('admin-account-summary'),
            {'scope': 'recruiters'},
        )

        self.assertEqual(users.status_code, 200, users.data)
        self.assertEqual(users.data['by_role']['candidate']['total'], 1)
        self.assertEqual(users.data['by_role']['candidate']['restricted'], 1)
        self.assertEqual(users.data['queues']['pending_admin_invitations'], 1)
        self.assertEqual(recruiters.status_code, 200, recruiters.data)
        self.assertEqual(recruiters.data['totals']['total'], 2)
        self.assertEqual(recruiters.data['linked_company'], 1)
        self.assertEqual(recruiters.data['companyless'], 1)
        self.assertEqual(recruiters.data['onboarding_incomplete'], 1)
        self.assertEqual(recruiters.data['verification']['approved'], 1)

    def test_recruiter_list_derives_initial_setup_and_supports_ordering(self):
        complete_user = User.objects.create_user(
            'complete-setup@example.com',
            self.password,
            role=User.Role.EMPLOYER,
            status=User.Status.ACTIVE,
            email_verified=True,
        )
        incomplete_user = User.objects.create_user(
            'incomplete-setup@example.com',
            self.password,
            role=User.Role.EMPLOYER,
            status=User.Status.ACTIVE,
            email_verified=False,
        )
        RecruiterProfile.objects.create(
            user=complete_user,
            registration_completed_at=timezone.now(),
        )
        RecruiterProfile.objects.create(
            user=incomplete_user,
            registration_completed_at=timezone.now(),
        )
        self.authenticate(self.superuser)

        response = self.client.get(
            reverse('admin-account-list'),
            {
                'scope': 'recruiters',
                'ordering': '-recruiter_initial_onboarding_completed',
            },
        )

        self.assertEqual(response.status_code, 200, response.data)
        results = response.data['results']
        self.assertEqual(results[0]['public_id'], complete_user.public_id)
        self.assertTrue(results[0]['context']['initial_onboarding']['completed'])
        incomplete = next(
            item for item in results if item['public_id'] == incomplete_user.public_id
        )
        self.assertEqual(
            incomplete['context']['initial_onboarding']['missing_steps'],
            ['email_verified'],
        )

    def test_banning_employer_holds_only_nonterminal_campaigns(self):
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
            enforcement_evidence='Ticket SEC-123 đã được bộ phận an toàn xác minh.',
            violation_category='policy',
        )

        confirm_account_status(
            employer,
            status=User.Status.BANNED,
            reason='Vi phạm chính sách.',
            enforcement_evidence='Ticket SEC-123 đã được bộ phận an toàn xác minh.',
            violation_category='policy',
            impact_token=impact['impact_token'],
            actor=self.superuser,
        )

        active_campaign.refresh_from_db()
        completed_campaign.refresh_from_db()
        self.assertEqual(active_campaign.status, RecruitmentCampaign.Status.ACTIVE)
        self.assertEqual(
            active_campaign.policy_hold,
            RecruitmentCampaign.PolicyHold.BAN_REVIEW,
        )
        self.assertEqual(completed_campaign.status, RecruitmentCampaign.Status.COMPLETED)
        self.assertEqual(
            completed_campaign.policy_hold,
            RecruitmentCampaign.PolicyHold.NONE,
        )
        self.assertTrue(
            CampaignActivity.objects.filter(
                campaign=active_campaign,
                event_type=CampaignActivity.EventType.ACCOUNT_POLICY_HELD,
                actor=self.superuser,
                metadata__reason='account_status_policy_hold',
            ).exists()
        )

    def invite(self, *, email='new-admin@example.com', actor=None):
        self.authenticate(actor or self.superuser)
        return self.client.post(
            reverse('admin-account-invitation-list'),
            {
                'email': email,
                'full_name': 'Nhân viên mới',
                'reason': 'Bổ sung nhân sự kiểm duyệt ca tối',
            },
            format='json',
        )

    def test_superuser_creates_invitation_without_role(self):
        response = self.invite()

        self.assertEqual(response.status_code, 201, response.data)
        self.assertNotIn('target_role', response.json())
        pending = User.objects.get(email='new-admin@example.com', role=User.Role.ADMIN)
        self.assertEqual(pending.status, User.Status.PENDING)
        self.assertFalse(pending.is_superuser)
        self.assertEqual(
            AdminInvitation.objects.get(public_id=response.json()['public_id']).user,
            pending,
        )

    def test_regular_admin_is_denied_on_invitations(self):
        invitation = create_admin_invitation(
            email='existing-invite@example.com',
            full_name='Lời mời có sẵn',
            reason='Nhu cầu ca sáng',
            actor=self.superuser,
        )
        detail_kwargs = {'public_id': invitation.public_id}

        created = self.invite(email='denied@example.com', actor=self.regular_admin)
        responses = (
            created,
            self.client.get(reverse('admin-account-invitation-list')),
            self.client.post(
                reverse('admin-account-invitation-resend', kwargs=detail_kwargs), format='json'
            ),
            self.client.post(
                reverse('admin-account-invitation-revoke', kwargs=detail_kwargs),
                {'reason': 'Thử thu hồi'},
                format='json',
            ),
        )

        for response in responses:
            self.assertEqual(response.status_code, 403)
            self.assertEqual(response.json()['code'], 'admin_permission_denied')
        self.assertFalse(User.objects.filter(email='denied@example.com').exists())
        invitation.refresh_from_db()
        self.assertEqual(invitation.status, AdminInvitation.Status.PENDING)

    def test_superuser_revokes_pending_invitation(self):
        invitation = AdminInvitation.objects.get(public_id=self.invite().json()['public_id'])

        response = self.client.post(
            reverse('admin-account-invitation-revoke', kwargs={'public_id': invitation.public_id}),
            {'reason': 'Nhân sự không nhận việc'},
            format='json',
        )

        self.assertEqual(response.status_code, 200, response.data)
        invitation.refresh_from_db()
        self.assertEqual(invitation.status, AdminInvitation.Status.REVOKED)

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

    def test_resend_invalidates_old_link_and_accept_activates_account(self):
        response = self.invite()
        invitation = AdminInvitation.objects.get(public_id=response.json()['public_id'])
        old_token = create_admin_invitation_token(invitation)

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
        validated = APIClient().get(reverse('auth-admin-invitation-validate'), {'token': token})
        self.assertEqual(validated.status_code, 200)
        self.assertEqual(set(validated.json()), {'email', 'full_name', 'expires_at'})
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

        invitation.refresh_from_db()
        user = invitation.user
        user.refresh_from_db()
        self.assertEqual(invitation.status, AdminInvitation.Status.ACCEPTED)
        self.assertEqual(user.status, User.Status.ACTIVE)
        self.assertTrue(user.is_active)
        self.assertTrue(user.email_verified)
        self.assertFalse(user.is_superuser)
        self.assertTrue(user.check_password(self.password))
        audit = AdminAccessAuditLog.objects.get(action='accept_admin_invitation')
        self.assertEqual(audit.payload, {'user_public_id': user.public_id})

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

    def test_account_list_query_count_stays_flat(self):
        self.authenticate(self.superuser)
        url = reverse('admin-account-list')
        with CaptureQueriesContext(connection) as baseline:
            response = self.client.get(url, {'scope': 'users'})
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
            response = self.client.get(url, {'scope': 'users'})
            self.assertEqual(response.status_code, 200)
            list(response.data['results'])
        self.assertLessEqual(len(expanded), len(baseline) + 1)

    def test_superuser_cannot_send_password_reset_to_locked_admin(self):
        locked_admin = make_admin(
            'locked-admin@example.com',
            password=self.password,
            status=User.Status.BANNED,
            is_active=False,
        )
        self.authenticate(self.superuser)

        response = self.client.post(
            reverse(
                'admin-account-send-password-reset',
                kwargs={'public_id': locked_admin.public_id},
            ),
            {'reason': 'Admin báo quên mật khẩu qua quy trình hỗ trợ nội bộ'},
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

    def test_password_reset_email_requires_and_audits_a_reason(self):
        managed_admin = make_admin('managed-admin@example.com', password=self.password)
        self.authenticate(self.superuser)
        url = reverse(
            'admin-account-send-password-reset',
            kwargs={'public_id': managed_admin.public_id},
        )

        missing_reason = self.client.post(url, {}, format='json')
        self.assertEqual(missing_reason.status_code, 400)
        self.assertIn('reason', missing_reason.json())

        reason = 'Đã xác minh danh tính admin qua quy trình hỗ trợ nội bộ'
        response = self.client.post(url, {'reason': reason}, format='json')

        self.assertEqual(response.status_code, 200)
        self.assertTrue(
            AuthEmailJob.objects.filter(
                user=managed_admin,
                kind=AuthEmailJob.Kind.PASSWORD_RESET,
            ).exists()
        )
        audit = AdminAccessAuditLog.objects.filter(
            action='send_account_password_reset',
            target_public_id=managed_admin.public_id,
        ).latest('created_at')
        self.assertEqual(audit.payload['reason'], reason)

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

    def test_audit_log_scope_all_is_superuser_only(self):
        url = reverse('admin-audit-log-list')
        self.authenticate(self.regular_admin)
        own = self.client.get(url)
        denied = self.client.get(url, {'scope': 'all'})
        self.authenticate(self.superuser)
        allowed = self.client.get(url, {'scope': 'all'})

        self.assertEqual(own.status_code, 200)
        self.assertEqual(denied.status_code, 403)
        self.assertEqual(denied.json()['code'], 'admin_permission_denied')
        self.assertEqual(allowed.status_code, 200)


class AdminPortalPermissionTests(TestCase):
    def check(self, user, *, action, require_superuser):
        request = APIRequestFactory().get('/')
        request.user = user
        view = SimpleNamespace(action=action, require_superuser=require_superuser)
        return AdminPortalPermission().has_permission(request, view)

    def test_dict_requirement_only_guards_listed_actions(self):
        regular = make_admin()
        superuser = make_admin('root@example.com', superuser=True)
        candidate = User.objects.create_user('candidate@example.com', role=User.Role.CANDIDATE)
        requirement = {'actions': {'destroy'}}

        self.assertTrue(self.check(regular, action='list', require_superuser=requirement))
        self.assertTrue(self.check(superuser, action='destroy', require_superuser=requirement))
        self.assertFalse(self.check(candidate, action='list', require_superuser=requirement))
        with self.assertRaises(AdminPermissionDenied):
            self.check(regular, action='destroy', require_superuser=requirement)
        with self.assertRaises(AdminPermissionDenied):
            self.check(regular, action='list', require_superuser=True)


class AccountManagementG3DemoSeedTests(TestCase):
    def test_demo_seed_is_idempotent_and_provides_password_login(self):
        output = StringIO()
        management.call_command('seed_admin_account_demo', force=True, stdout=output)
        management.call_command('seed_admin_account_demo', force=True, stdout=output)

        admins = User.objects.filter(
            email__in=[
                'admin-root@demo.local',
                'moderator-admin@demo.local',
            ],
            role=User.Role.ADMIN,
        )
        self.assertEqual(admins.count(), 2)
        root = admins.get(email='admin-root@demo.local')
        self.assertTrue(root.is_superuser)
        self.assertFalse(admins.get(email='moderator-admin@demo.local').is_superuser)
        self.assertTrue(root.check_password('AdminDemo123!'))
        self.assertIn('admin-root@demo.local', output.getvalue())


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
        root = make_admin('concurrency-root@example.com', superuser=True, password=self.password)
        invitation = create_admin_invitation(
            email='race@example.com',
            full_name='Concurrent Admin',
            reason='Kiểm tra chống chấp nhận trùng',
            actor=root,
        )
        self.user_public_id = invitation.user.public_id
        self.token = create_admin_invitation_token(invitation)

    def test_concurrent_accept_succeeds_exactly_once(self):
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
        self.assertEqual(
            AdminAccessAuditLog.objects.filter(
                action='accept_admin_invitation', target_public_id=self.user_public_id
            ).count(),
            1,
        )


class DemoAccountProductionGuardTests(TestCase):
    @override_settings(IS_PRODUCTION=True)
    def test_admin_demo_seed_refuses_production_even_with_force(self):
        with self.assertRaises(management.CommandError):
            management.call_command('seed_admin_account_demo', force=True, stdout=StringIO())

        self.assertFalse(User.objects.filter(email__endswith='@demo.local').exists())

    def test_purge_lists_by_default_and_deletes_only_with_confirm(self):
        management.call_command('seed_admin_account_demo', force=True, stdout=StringIO())
        kept = User.objects.create_user(
            email='real@procv.site', password='Str0ng-pass!', role=User.Role.CANDIDATE
        )

        output = StringIO()
        management.call_command('purge_demo_accounts', stdout=output)
        self.assertIn('admin: 2', output.getvalue())
        self.assertEqual(User.objects.filter(email__endswith='@demo.local').count(), 2)

        management.call_command('purge_demo_accounts', confirm=True, stdout=StringIO())
        self.assertFalse(User.objects.filter(email__endswith='@demo.local').exists())
        self.assertTrue(User.objects.filter(pk=kept.pk).exists())
