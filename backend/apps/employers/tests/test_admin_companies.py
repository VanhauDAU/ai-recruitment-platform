from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.accounts.models import AdminPermission, AdminRole, Department, User
from apps.accounts.services import assign_membership

from ..models import (
    Company,
    CompanyUpdateRequest,
    EmployerVerificationCase,
    Industry,
    RecruiterProfile,
)
from ..selectors import admin_companies_queryset


class AdminCompanyApiTests(APITestCase):
    def setUp(self):
        self.superuser = User.objects.create_superuser(
            email='company-admin@example.com',
            password='Password@123',
        )
        self.owner_user = self._employer('owner@example.com', 'Owner chính')
        self.member_user = self._employer('member@example.com', 'Member một')
        self.company = Company.objects.create(
            company_name='Công ty Alpha',
            trade_name='Alpha',
            tax_code='0101234567',
            email='contact@alpha.example',
            phone='0901234567',
            address='Hà Nội',
            verification_status=Company.VerificationStatus.PENDING,
            created_by=self.owner_user,
        )
        self.industry = Industry.objects.create(name='Công nghệ', slug='cong-nghe')
        self.company.industries.add(self.industry)
        self.owner = RecruiterProfile.objects.create(
            user=self.owner_user,
            company=self.company,
            company_role=RecruiterProfile.CompanyRole.OWNER,
            contact_phone='0901111111',
            verified_phone='0901111111',
            phone_verified_at=timezone.now(),
            onboarding_completed_at=timezone.now(),
        )
        self.member = RecruiterProfile.objects.create(
            user=self.member_user,
            company=self.company,
            company_role=RecruiterProfile.CompanyRole.MEMBER,
        )
        self.owner_case = EmployerVerificationCase.objects.create(
            recruiter=self.owner,
            company=self.company,
            status=EmployerVerificationCase.Status.APPROVED,
            submitted_at=timezone.now(),
            decided_at=timezone.now(),
        )

    def _employer(self, email, full_name):
        return User.objects.create_user(
            email=email,
            password='Password@123',
            role=User.Role.EMPLOYER,
            status=User.Status.ACTIVE,
            full_name=full_name,
            email_verified=True,
        )

    def _limited_admin(self, *permission_codes):
        user = User.objects.create_user(
            email=f'limited-{User.objects.count()}@example.com',
            password='Password@123',
            role=User.Role.ADMIN,
            status=User.Status.ACTIVE,
        )
        department = Department.objects.create(
            code=f'company-{Department.objects.count()}',
            name='Quản trị công ty',
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
                defaults={
                    'module': 'company',
                    'label': code,
                },
            )
            role.permissions.add(permission)
        assign_membership(user, role, actor=self.superuser)
        return user

    def test_list_keeps_company_and_recruiter_verification_statuses_separate(self):
        self.client.force_authenticate(self.superuser)

        response = self.client.get(
            reverse('admin-company-list'),
            {
                'verification_status': Company.VerificationStatus.PENDING,
                'recruiter_verification_status': EmployerVerificationCase.Status.APPROVED,
            },
        )

        self.assertEqual(response.status_code, 200, response.data)
        item = response.data['results'][0]
        self.assertEqual(item['verification_status'], 'pending')
        self.assertEqual(item['recruiter_verification_summary']['approved'], 1)
        self.assertEqual(item['recruiter_verification_summary']['none'], 1)
        self.assertEqual(item['owner_count'], 1)
        self.assertEqual(item['member_count'], 1)

    def test_list_filters_company_without_owner_and_masks_sensitive_values(self):
        no_owner_creator = self._employer('creator@example.com', 'Người tạo')
        no_owner = Company.objects.create(
            company_name='Công ty chưa có owner',
            tax_code='0207654321',
            created_by=no_owner_creator,
        )
        admin = self._limited_admin('company.view')
        self.client.force_authenticate(admin)

        response = self.client.get(reverse('admin-company-list'), {'has_owner': 'false'})

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(
            [item['public_id'] for item in response.data['results']], [no_owner.public_id]
        )
        self.assertEqual(response.data['results'][0]['tax_code'], '***4321')

    def test_sensitive_permission_reveals_company_contact_details(self):
        admin = self._limited_admin('company.view', 'company.sensitive.view')
        self.client.force_authenticate(admin)

        response = self.client.get(
            reverse('admin-company-detail', kwargs={'public_id': self.company.public_id})
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['tax_code'], '0101234567')
        self.assertEqual(response.data['email'], 'contact@alpha.example')
        self.assertEqual(response.data['phone'], '0901234567')

    def test_recruiter_roster_requires_permission_and_supports_role_and_status_filters(self):
        view_only = self._limited_admin('company.view')
        url = reverse(
            'admin-company-recruiters',
            kwargs={'public_id': self.company.public_id},
        )
        self.client.force_authenticate(view_only)
        denied = self.client.get(url)
        self.assertEqual(denied.status_code, 403)

        roster_admin = self._limited_admin('company.view', 'company_recruiter.view')
        self.client.force_authenticate(roster_admin)
        response = self.client.get(
            url,
            {
                'role': RecruiterProfile.CompanyRole.OWNER,
                'verification_status': EmployerVerificationCase.Status.APPROVED,
            },
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['count'], 1)
        recruiter = response.data['results'][0]
        self.assertEqual(recruiter['public_id'], self.owner.public_id)
        self.assertEqual(recruiter['company_role'], 'owner')
        self.assertEqual(recruiter['verification']['status'], 'approved')
        self.assertEqual(recruiter['contact_phone'], '***111')

    def test_recruiter_without_case_is_reported_as_none(self):
        self.client.force_authenticate(self.superuser)
        response = self.client.get(
            reverse(
                'admin-company-recruiters',
                kwargs={'public_id': self.company.public_id},
            ),
            {'verification_status': 'none'},
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(response.data['results'][0]['public_id'], self.member.public_id)
        self.assertEqual(response.data['results'][0]['verification']['status'], 'none')

    def test_directory_resolves_company_logo_and_recruiter_avatar_urls(self):
        self.company.logo_url = 'employers/logos/alpha.png'
        self.company.save(update_fields=['logo_url'])
        self.owner_user.avatar_url = 'users/avatars/owner.png'
        self.owner_user.save(update_fields=['avatar_url'])
        self.client.force_authenticate(self.superuser)

        company_response = self.client.get(
            reverse('admin-company-detail', kwargs={'public_id': self.company.public_id})
        )
        roster_response = self.client.get(
            reverse(
                'admin-company-recruiters',
                kwargs={'public_id': self.company.public_id},
            ),
            {'role': RecruiterProfile.CompanyRole.OWNER},
        )

        self.assertEqual(company_response.status_code, 200, company_response.data)
        self.assertIn('/media/employers/logos/alpha.png', company_response.data['logo_url'])
        self.assertEqual(roster_response.status_code, 200, roster_response.data)
        self.assertIn(
            '/media/users/avatars/owner.png',
            roster_response.data['results'][0]['account']['avatar_url'],
        )

    def test_list_and_roster_apply_whitelisted_server_ordering(self):
        other_creator = self._employer('other-owner@example.com', 'Owner khác')
        other_company = Company.objects.create(
            company_name='Công ty Beta',
            created_by=other_creator,
        )
        RecruiterProfile.objects.create(
            user=other_creator,
            company=other_company,
            company_role=RecruiterProfile.CompanyRole.OWNER,
        )
        self.client.force_authenticate(self.superuser)

        companies = self.client.get(
            reverse('admin-company-list'),
            {'ordering': '-recruiter_count'},
        )
        roster = self.client.get(
            reverse(
                'admin-company-recruiters',
                kwargs={'public_id': self.company.public_id},
            ),
            {'ordering': '-user__email'},
        )

        self.assertEqual(companies.status_code, 200, companies.data)
        self.assertEqual(companies.data['results'][0]['public_id'], self.company.public_id)
        self.assertEqual(roster.status_code, 200, roster.data)
        self.assertEqual(
            [item['account']['email'] for item in roster.data['results']],
            sorted(
                [self.owner_user.email, self.member_user.email],
                reverse=True,
            ),
        )

    def test_summary_uses_all_companies_instead_of_the_current_page(self):
        for index in range(22):
            creator = self._employer(
                f'summary-owner-{index}@example.com',
                f'Owner {index}',
            )
            Company.objects.create(
                company_name=f'Công ty summary {index}',
                verification_status=(
                    Company.VerificationStatus.VERIFIED
                    if index < 3
                    else Company.VerificationStatus.UNVERIFIED
                ),
                created_by=creator,
            )
        self.client.force_authenticate(self.superuser)

        response = self.client.get(reverse('admin-company-summary'))

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['total'], 23)
        self.assertEqual(response.data['verification']['verified'], 3)
        self.assertEqual(response.data['verification']['pending'], 1)
        self.assertEqual(response.data['companies_without_single_owner'], 22)

    def test_company_update_queue_orders_by_number_of_changed_fields(self):
        small = CompanyUpdateRequest.objects.create(
            company=self.company,
            requested_by=self.owner_user,
            changes={'trade_name': 'Alpha mới'},
        )
        other_owner = self._employer('update-owner@example.com', 'Owner cập nhật')
        other_company = Company.objects.create(
            company_name='Công ty cập nhật',
            created_by=other_owner,
        )
        large = CompanyUpdateRequest.objects.create(
            company=other_company,
            requested_by=other_owner,
            changes={
                'company_name': 'Tên mới',
                'trade_name': 'Tên thương mại mới',
                'address': 'Địa chỉ mới',
            },
        )
        self.client.force_authenticate(self.superuser)

        response = self.client.get(
            reverse('admin-company-update-request-list'),
            {'ordering': '-change_count'},
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(
            [item['public_id'] for item in response.data['results']],
            [large.public_id, small.public_id],
        )


class AdminCompanyQueryBudgetTests(TestCase):
    def setUp(self):
        self.creator = User.objects.create_user(
            email='creator-budget@example.com',
            password='Password@123',
            role=User.Role.EMPLOYER,
        )

    def _company(self, index):
        company = Company.objects.create(
            company_name=f'Công ty {index}',
            created_by=self.creator,
        )
        industry = Industry.objects.create(name=f'Ngành {index}', slug=f'nganh-{index}')
        company.industries.add(industry)
        recruiter_user = User.objects.create_user(
            email=f'recruiter-{index}@example.com',
            password='Password@123',
            role=User.Role.EMPLOYER,
        )
        RecruiterProfile.objects.create(
            user=recruiter_user,
            company=company,
            company_role=RecruiterProfile.CompanyRole.OWNER,
        )

    def test_company_list_query_count_is_flat(self):
        self._company(1)
        with self.assertNumQueries(3):
            list(admin_companies_queryset())

        for index in range(2, 7):
            self._company(index)
        with self.assertNumQueries(3):
            list(admin_companies_queryset())
