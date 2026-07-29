from datetime import timedelta

from django.core.exceptions import ValidationError
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from apps.employers.models import Company, RecruiterProfile, RecruitmentCampaign
from apps.jobs.models import Job, SavedJob
from apps.jobs.selectors.listing import publicly_available_job_filter

from ..admin_access_rules import StaleImpactToken
from ..models import (
    AccountStatusTransition,
    AdminMembership,
    AdminPermission,
    AdminRole,
    AuthEmailJob,
    AuthSession,
    Department,
    User,
)
from ..selectors import (
    account_resource_hold_impact,
    account_status_impact,
)
from ..services import (
    confirm_account_status,
    confirm_release_account_resource_holds,
)


class AccountStatusEnforcementTests(TestCase):
    def setUp(self):
        self.superuser = User.objects.create_superuser(
            email='status-root@example.com',
            password='Password@123',
        )
        self.employer = User.objects.create_user(
            email='status-employer@example.com',
            password='Password@123',
            role=User.Role.EMPLOYER,
        )
        self.company = Company.objects.create(
            company_name='Status Company',
            created_by=self.employer,
        )
        self.recruiter = RecruiterProfile.objects.create(
            user=self.employer,
            company=self.company,
        )
        self.campaign = RecruitmentCampaign.objects.create(
            owner=self.recruiter,
            company=self.company,
            name='Hiring campaign',
            status=RecruitmentCampaign.Status.ACTIVE,
        )
        self.job = Job.objects.create(
            posted_by=self.employer,
            company=self.company,
            campaign=self.campaign,
            title='Backend Engineer',
            description='Build secure recruitment workflows.',
            status=Job.Status.ACTIVE,
        )

    def change_status(
        self,
        status,
        *,
        reason='Yêu cầu vận hành đã được xác minh.',
        evidence='Ticket SEC-123 đã được kiểm tra bởi hai nguồn độc lập.',
        category='',
    ):
        payload = {
            'status': status,
            'reason': reason,
            'enforcement_evidence': evidence
            if (status == User.Status.BANNED or self.employer.status == User.Status.BANNED)
            else '',
            'violation_category': category,
        }
        impact = account_status_impact(self.employer, **payload)
        result = confirm_account_status(
            self.employer,
            actor=self.superuser,
            impact_token=impact['impact_token'],
            **payload,
        )
        self.employer.refresh_from_db()
        self.campaign.refresh_from_db()
        self.job.refresh_from_db()
        return result, impact

    def test_temporary_lock_preserves_business_status_and_restores_only_temporary_holds(self):
        original_revision = self.employer.auth_revision
        candidate = User.objects.create_user(
            email='status-candidate@example.com',
            password='Password@123',
            role=User.Role.CANDIDATE,
        )
        SavedJob.objects.create(candidate=candidate, job=self.job)
        candidate_client = APIClient()
        candidate_client.force_authenticate(candidate)
        session = AuthSession.objects.create(
            user=self.employer,
            portal=self.employer.role,
            refresh_jti='status-session',
            auth_revision=original_revision,
            expires_at=timezone.now() + timedelta(days=1),
        )
        stale_email = AuthEmailJob.objects.create(
            user=self.employer,
            kind=AuthEmailJob.Kind.PASSWORD_RESET,
            context={
                'email': self.employer.email,
                'auth_revision': original_revision,
            },
        )
        self.assertTrue(
            Job.objects.filter(publicly_available_job_filter(), pk=self.job.pk).exists()
        )
        self.assertEqual(
            len(candidate_client.get(reverse('saved-job-list-create')).data),
            1,
        )

        self.change_status(User.Status.INACTIVE)

        session.refresh_from_db()
        stale_email.refresh_from_db()
        self.assertEqual(self.employer.auth_revision, original_revision + 1)
        self.assertIsNotNone(session.revoked_at)
        self.assertEqual(stale_email.status, AuthEmailJob.Status.CANCELLED)
        self.assertEqual(self.campaign.status, RecruitmentCampaign.Status.ACTIVE)
        self.assertEqual(self.job.status, Job.Status.ACTIVE)
        self.assertEqual(
            self.campaign.policy_hold,
            RecruitmentCampaign.PolicyHold.TEMPORARY_LOCK,
        )
        self.assertEqual(self.job.policy_hold, Job.PolicyHold.TEMPORARY_LOCK)
        self.assertFalse(
            Job.objects.filter(publicly_available_job_filter(), pk=self.job.pk).exists()
        )
        self.assertEqual(
            len(candidate_client.get(reverse('saved-job-list-create')).data),
            0,
        )

        self.change_status(User.Status.ACTIVE)

        self.assertEqual(self.campaign.policy_hold, RecruitmentCampaign.PolicyHold.NONE)
        self.assertEqual(self.job.policy_hold, Job.PolicyHold.NONE)
        self.assertEqual(self.campaign.status, RecruitmentCampaign.Status.ACTIVE)
        self.assertEqual(self.job.status, Job.Status.ACTIVE)
        self.assertTrue(
            Job.objects.filter(publicly_available_job_filter(), pk=self.job.pk).exists()
        )
        self.assertEqual(
            len(candidate_client.get(reverse('saved-job-list-create')).data),
            1,
        )

    def test_ban_requires_staged_reactivation_and_does_not_affect_other_recruiter(self):
        colleague = User.objects.create_user(
            email='status-colleague@example.com',
            password='Password@123',
            role=User.Role.EMPLOYER,
        )
        RecruiterProfile.objects.create(user=colleague, company=self.company)
        colleague_job = Job.objects.create(
            posted_by=colleague,
            company=self.company,
            title='Unaffected role',
            description='This recruiter remains active.',
            status=Job.Status.ACTIVE,
        )

        self.change_status(User.Status.BANNED, category='policy')

        self.assertEqual(self.campaign.policy_hold, RecruitmentCampaign.PolicyHold.BAN_REVIEW)
        self.assertEqual(self.job.policy_hold, Job.PolicyHold.BAN_REVIEW)
        self.assertTrue(
            Job.objects.filter(publicly_available_job_filter(), pk=colleague_job.pk).exists()
        )
        active_impact = account_status_impact(
            self.employer,
            status=User.Status.ACTIVE,
            reason='Không được mở trực tiếp.',
            enforcement_evidence='Ticket SEC-123 đã được kiểm tra bởi hai nguồn độc lập.',
        )
        self.assertFalse(active_impact['can_apply'])
        with self.assertRaises(ValidationError):
            confirm_account_status(
                self.employer,
                status=User.Status.ACTIVE,
                reason='Không được mở trực tiếp.',
                enforcement_evidence='Ticket SEC-123 đã được kiểm tra bởi hai nguồn độc lập.',
                impact_token=active_impact['impact_token'],
                actor=self.superuser,
            )

        self.change_status(User.Status.INACTIVE)
        self.assertEqual(self.campaign.policy_hold, RecruitmentCampaign.PolicyHold.BAN_REVIEW)
        self.assertEqual(self.job.policy_hold, Job.PolicyHold.BAN_REVIEW)

        release_payload = {
            'reason': 'Đã rà soát toàn bộ tài nguyên liên quan.',
            'enforcement_evidence': (
                'Biên bản REV-123 xác nhận tin và chiến dịch đủ điều kiện khôi phục.'
            ),
        }
        release_impact = account_resource_hold_impact(self.employer, **release_payload)
        confirm_release_account_resource_holds(
            self.employer,
            actor=self.superuser,
            impact_token=release_impact['impact_token'],
            **release_payload,
        )
        self.campaign.refresh_from_db()
        self.job.refresh_from_db()
        self.assertEqual(self.campaign.policy_hold, RecruitmentCampaign.PolicyHold.NONE)
        self.assertEqual(self.job.policy_hold, Job.PolicyHold.NONE)
        self.assertEqual(self.employer.status, User.Status.INACTIVE)

        self.change_status(User.Status.ACTIVE)
        self.assertTrue(
            Job.objects.filter(publicly_available_job_filter(), pk=self.job.pk).exists()
        )
        self.assertEqual(
            list(self.employer.status_transitions.values_list('kind', flat=True).order_by('id')),
            [
                AccountStatusTransition.Kind.BAN,
                AccountStatusTransition.Kind.BEGIN_REACTIVATION,
                AccountStatusTransition.Kind.RELEASE_RESOURCE_HOLDS,
                AccountStatusTransition.Kind.REACTIVATE,
            ],
        )

    def test_resource_change_makes_preview_stale(self):
        impact = account_status_impact(
            self.employer,
            status=User.Status.INACTIVE,
            reason='Tạm khóa để rà soát.',
        )
        Job.objects.create(
            posted_by=self.employer,
            company=self.company,
            title='Created after preview',
            description='Changes the bound impact snapshot.',
        )

        with self.assertRaises(StaleImpactToken):
            confirm_account_status(
                self.employer,
                status=User.Status.INACTIVE,
                reason='Tạm khóa để rà soát.',
                impact_token=impact['impact_token'],
                actor=self.superuser,
            )

    def test_status_notice_never_contains_internal_evidence(self):
        evidence = 'Ticket SEC-999 chứa bằng chứng nội bộ không được gửi qua email.'
        self.change_status(
            User.Status.BANNED,
            evidence=evidence,
            category='security',
        )

        notice = AuthEmailJob.objects.get(
            user=self.employer,
            kind=AuthEmailJob.Kind.ACCOUNT_STATUS_NOTICE,
        )
        self.assertNotIn(evidence, str(notice.context))
        self.assertEqual(notice.context['after_status'], User.Status.BANNED)


class AccountStatusEnforcementApiTests(TestCase):
    password = 'StrongPass123!'

    def setUp(self):
        self.superuser = User.objects.create_superuser(
            email='status-api-root@example.com',
            password=self.password,
        )
        self.operator = User.objects.create_user(
            email='status-api-operator@example.com',
            password=self.password,
            role=User.Role.ADMIN,
        )
        department = Department.objects.create(
            code='status-operations',
            name='Status Operations',
        )
        role = AdminRole.objects.create(
            department=department,
            code='status-operator',
            name='Status operator',
        )
        role.permissions.add(
            AdminPermission.objects.get(code='account.view'),
            AdminPermission.objects.get(code='account.status.manage'),
        )
        AdminMembership.objects.create(user=self.operator, role=role)
        self.target = User.objects.create_user(
            email='status-api-target@example.com',
            password=self.password,
            role=User.Role.EMPLOYER,
        )
        self.company = Company.objects.create(
            company_name='Status API Company',
            created_by=self.target,
        )
        self.recruiter = RecruiterProfile.objects.create(
            user=self.target,
            company=self.company,
        )
        self.client = APIClient()

    def endpoint(self, name, user=None):
        return reverse(
            f'admin-account-{name}',
            kwargs={'public_id': (user or self.target).public_id},
        )

    def test_operator_can_suspend_but_cannot_ban(self):
        self.client.force_authenticate(self.operator)
        suspend_payload = {
            'status': User.Status.INACTIVE,
            'reason': 'Tạm khóa theo yêu cầu đã được xác minh.',
            'enforcement_evidence': '',
            'violation_category': '',
        }
        impact = self.client.post(
            self.endpoint('status-impact'),
            suspend_payload,
            format='json',
        )
        self.assertEqual(impact.status_code, 200, impact.data)

        confirmed = self.client.post(
            self.endpoint('change-status'),
            {**suspend_payload, 'impact_token': impact.data['impact_token']},
            format='json',
        )
        self.assertEqual(confirmed.status_code, 200, confirmed.data)
        self.target.refresh_from_db()
        self.assertEqual(self.target.status, User.Status.INACTIVE)
        self.assertFalse(self.target.is_active)

        denied = self.client.post(
            self.endpoint('status-impact'),
            {
                'status': User.Status.BANNED,
                'reason': 'Phát hiện vi phạm cần cấm.',
                'enforcement_evidence': ('Ticket SEC-403 đã được đối chiếu bởi bộ phận an toàn.'),
                'violation_category': 'security',
            },
            format='json',
        )
        self.assertEqual(denied.status_code, 403, denied.data)

    def test_stale_resource_snapshot_returns_409_without_mutation(self):
        self.client.force_authenticate(self.superuser)
        payload = {
            'status': User.Status.INACTIVE,
            'reason': 'Tạm khóa để rà soát dữ liệu.',
            'enforcement_evidence': '',
            'violation_category': '',
        }
        impact = self.client.post(
            self.endpoint('status-impact'),
            payload,
            format='json',
        )
        self.assertEqual(impact.status_code, 200, impact.data)
        Job.objects.create(
            posted_by=self.target,
            company=self.company,
            title='Changed after impact',
            description='This changes the bound resource snapshot.',
        )

        confirmed = self.client.post(
            self.endpoint('change-status'),
            {**payload, 'impact_token': impact.data['impact_token']},
            format='json',
        )

        self.assertEqual(confirmed.status_code, 409, confirmed.data)
        self.target.refresh_from_db()
        self.assertEqual(self.target.status, User.Status.ACTIVE)
        self.assertTrue(self.target.is_active)

    def test_pending_and_soft_deleted_targets_fail_closed(self):
        pending = User.objects.create_user(
            email='status-api-pending@example.com',
            password=self.password,
            role=User.Role.EMPLOYER,
            status=User.Status.PENDING,
            is_active=False,
        )
        deleted = User.objects.create_user(
            email='status-api-deleted@example.com',
            password=self.password,
            role=User.Role.EMPLOYER,
            is_deleted=True,
        )
        self.client.force_authenticate(self.superuser)
        payload = {
            'status': User.Status.INACTIVE,
            'reason': 'Không được xử lý bằng workflow này.',
        }

        pending_response = self.client.post(
            self.endpoint('status-impact', pending),
            payload,
            format='json',
        )
        deleted_response = self.client.post(
            self.endpoint('status-impact', deleted),
            payload,
            format='json',
        )

        self.assertEqual(pending_response.status_code, 400, pending_response.data)
        self.assertEqual(deleted_response.status_code, 404, deleted_response.data)
