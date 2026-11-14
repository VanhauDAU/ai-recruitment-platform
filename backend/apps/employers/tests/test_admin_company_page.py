"""Admin preview and policy hold of the public company page."""

from django.core.cache import cache
from django.urls import reverse
from rest_framework.test import APITestCase

from apps.accounts.models import (
    AdminAccessAuditLog,
    AdminPermission,
    AdminRole,
    Department,
    User,
)
from apps.accounts.services import assign_membership

from ..models import Company, CompanyPageEvent, Industry
from .company_page_helpers import add_recruiter, make_company, make_employer

HOLD_REASON = 'Nội dung giới thiệu vi phạm quy định cộng đồng.'
RELEASE_REASON = 'Doanh nghiệp đã chỉnh sửa nội dung theo yêu cầu.'


class AdminCompanyPublicPageTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.superuser = User.objects.create_superuser(
            email='page-admin@example.com',
            password='Password@123',
            full_name='Quản trị Trang',
        )
        self.company = make_company(
            make_employer('page-owner@example.com'),
            name='Công ty TNHH Phần mềm Alpha',
            trade_name='Alpha Tech',
            industry=Industry.objects.create(name='Công nghệ thông tin'),
            description='<p>Giới thiệu công ty.</p>',
        )
        add_recruiter(self.company)
        self.public_page_url = reverse('admin-company-public-page', args=[self.company.public_id])
        self.policy_hold_url = reverse('admin-company-policy-hold', args=[self.company.public_id])

    def _limited_admin(self, *permission_codes):
        user = User.objects.create_user(
            email=f'page-limited-{User.objects.count()}@example.com',
            password='Password@123',
            role=User.Role.ADMIN,
            status=User.Status.ACTIVE,
        )
        department = Department.objects.create(
            code=f'company-page-{Department.objects.count()}',
            name='Kiểm duyệt trang công ty',
        )
        role = AdminRole.objects.create(
            department=department,
            code='staff',
            name='Nhân viên',
            rank=10,
        )
        for code in permission_codes:
            permission, _ = AdminPermission.objects.get_or_create(
                code=code,
                defaults={'module': 'company', 'label': code},
            )
            role.permissions.add(permission)
        assign_membership(user, role, actor=self.superuser)
        return user

    def _hold(self, action='apply', reason=HOLD_REASON):
        return self.client.post(
            self.policy_hold_url,
            {'action': action, 'reason': reason},
            format='json',
        )

    def test_permission_matrix(self):
        employer = make_employer('page-outsider@example.com')
        cases = [
            # (user, GET public-page, POST policy-hold)
            (None, 401, 401),
            (employer, 403, 403),
            (self._limited_admin('dashboard.view'), 403, 403),
            (self._limited_admin('company.view'), 200, 403),
            (self._limited_admin('company_page.moderate'), 403, 403),
            (self._limited_admin('company.view', 'company_page.moderate'), 200, 200),
        ]
        for user, expected_view, expected_hold in cases:
            with self.subTest(user=getattr(user, 'email', 'anonymous')):
                self.client.force_authenticate(user)

                self.assertEqual(self.client.get(self.public_page_url).status_code, expected_view)
                self.assertEqual(self._hold().status_code, expected_hold)

                Company.objects.filter(pk=self.company.pk).update(content_policy_hold=False)

    def test_public_page_previews_the_exact_public_profile(self):
        public_profile = self.client.get(
            reverse('public-company-detail', args=[self.company.slug])
        ).data
        self.client.force_authenticate(self.superuser)

        response = self.client.get(self.public_page_url)

        self.assertEqual(response.status_code, 200, response.data)
        self.assertSetEqual(
            set(response.data),
            {'public_path', 'is_indexable', 'policy_hold', 'profile'},
        )
        self.assertEqual(response.data['public_path'], f'/cong-ty/{self.company.slug}')
        self.assertIs(response.data['is_indexable'], True)
        self.assertEqual(
            response.data['policy_hold'],
            {'active': False, 'reason': '', 'actor_name': '', 'at': None},
        )
        self.assertEqual(response.data['profile'], public_profile)

    def test_unknown_company_is_404(self):
        self.client.force_authenticate(self.superuser)

        response = self.client.get(reverse('admin-company-public-page', args=['co_unknown']))

        self.assertEqual(response.status_code, 404)

    def test_apply_hides_the_page_and_writes_both_audit_trails(self):
        updated_at = Company.objects.get(pk=self.company.pk).updated_at
        self.client.force_authenticate(self.superuser)

        response = self._hold()

        self.assertEqual(response.status_code, 200, response.data)
        self.assertIs(response.data['is_indexable'], False)
        hold = response.data['policy_hold']
        self.assertIs(hold['active'], True)
        self.assertEqual(hold['reason'], HOLD_REASON)
        self.assertEqual(hold['actor_name'], 'Quản trị Trang')
        self.assertIsNotNone(hold['at'])
        # The moderator still previews what was hidden.
        self.assertEqual(response.data['profile']['identity']['display_name'], 'Alpha Tech')
        self.assertIs(response.data['profile']['indexable'], False)

        company = Company.objects.get(pk=self.company.pk)
        self.assertIs(company.content_policy_hold, True)
        self.assertEqual(company.updated_at, updated_at)
        event = CompanyPageEvent.objects.get(company=company)
        self.assertEqual(event.event_type, CompanyPageEvent.EventType.POLICY_HOLD_APPLIED)
        self.assertEqual(event.actor, self.superuser)
        self.assertEqual(event.payload, {'reason': HOLD_REASON})
        self.assertTrue(event.public_id.startswith('cpe_'))
        audit = AdminAccessAuditLog.objects.get(action='apply_company_page_hold')
        self.assertEqual(audit.actor, self.superuser)
        self.assertEqual(audit.target_type, 'company')
        self.assertEqual(audit.target_public_id, company.public_id)
        self.assertEqual(audit.payload, {'reason': HOLD_REASON})

        self.client.force_authenticate(None)
        public = self.client.get(reverse('public-company-detail', args=[company.slug]))
        self.assertEqual(public.status_code, 404)

    def test_release_restores_the_page(self):
        updated_at = Company.objects.get(pk=self.company.pk).updated_at
        self.client.force_authenticate(self.superuser)
        self._hold()

        response = self._hold(action='release', reason=f'  {RELEASE_REASON}  ')

        self.assertEqual(response.status_code, 200, response.data)
        self.assertIs(response.data['is_indexable'], True)
        self.assertEqual(
            response.data['policy_hold'],
            {'active': False, 'reason': '', 'actor_name': '', 'at': None},
        )
        company = Company.objects.get(pk=self.company.pk)
        self.assertIs(company.content_policy_hold, False)
        self.assertEqual(company.updated_at, updated_at)
        self.assertEqual(
            list(
                CompanyPageEvent.objects.filter(company=company)
                .order_by('id')
                .values_list('event_type', 'payload__reason')
            ),
            [
                ('policy_hold_applied', HOLD_REASON),
                ('policy_hold_released', RELEASE_REASON),
            ],
        )
        audit = AdminAccessAuditLog.objects.get(action='release_company_page_hold')
        self.assertEqual(audit.payload, {'reason': RELEASE_REASON})

    def test_repeating_a_decision_is_rejected_without_new_audit_rows(self):
        self.client.force_authenticate(self.superuser)

        release_without_hold = self._hold(action='release', reason=RELEASE_REASON)
        self._hold()
        second_apply = self._hold()

        self.assertEqual(release_without_hold.status_code, 400)
        self.assertEqual(second_apply.status_code, 400)
        self.assertEqual(second_apply.data['detail'], 'Trang công ty đang bị tạm ẩn.')
        self.assertEqual(CompanyPageEvent.objects.count(), 1)
        self.assertEqual(
            AdminAccessAuditLog.objects.filter(action__endswith='company_page_hold').count(),
            1,
        )

    def test_reason_and_action_are_validated(self):
        self.client.force_authenticate(self.superuser)
        invalid_payloads = [
            {'action': 'apply'},
            {'action': 'apply', 'reason': 'Quá ngắn'},
            {'action': 'apply', 'reason': '   chín kt   '},
            {'action': 'apply', 'reason': 'x' * 501},
            {'action': 'delete', 'reason': HOLD_REASON},
            {'reason': HOLD_REASON},
        ]

        for payload in invalid_payloads:
            with self.subTest(payload=payload):
                response = self.client.post(self.policy_hold_url, payload, format='json')
                self.assertEqual(response.status_code, 400)

        self.assertIs(Company.objects.get(pk=self.company.pk).content_policy_hold, False)
        self.assertFalse(CompanyPageEvent.objects.exists())


class CompanyPageEventImmutabilityTests(APITestCase):
    def test_events_cannot_be_changed_or_removed(self):
        company = make_company(
            make_employer('page-event-owner@example.com'), name='Công ty Sự Kiện'
        )
        event = CompanyPageEvent.objects.create(
            company=company,
            event_type=CompanyPageEvent.EventType.POLICY_HOLD_APPLIED,
            payload={'reason': HOLD_REASON},
        )

        event.payload = {'reason': 'Đã sửa'}
        for mutate in (
            event.save,
            event.delete,
            lambda: CompanyPageEvent.objects.filter(pk=event.pk).update(payload={}),
            lambda: CompanyPageEvent.objects.filter(pk=event.pk).delete(),
        ):
            with self.assertRaises(ValueError):
                mutate()

        self.assertEqual(
            CompanyPageEvent.objects.get(pk=event.pk).payload,
            {'reason': HOLD_REASON},
        )
