"""Query-count contracts for employer recruitment-need reads."""

import re
from datetime import timedelta
from urllib.parse import urlsplit

from django.contrib.auth import get_user_model
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.jobs.models import Job, JobCategory

from ..models import (
    Company,
    CompanyDocument,
    CompanyIndustry,
    CompanyUpdateRequest,
    EmployerVerificationCase,
    Industry,
    RecruiterProfile,
    RecruitmentNeed,
)

# Authentication is bypassed with force_authenticate: one recruiter lookup plus
# one recruitment-need SELECT. The count must remain flat as rows are added.
RECRUITMENT_NEED_READ_BUDGET = 2
COMPANY_UPDATE_REQUEST_LIST_BUDGET = 4
ADMIN_COMPANY_UPDATE_REQUEST_LIST_BUDGET = 8
PUBLIC_COMPANY_LIST_QUERY_BUDGET = 5


def _canonical_job_table_references(queries):
    """Count SQL-level job scans, not just the number of ORM round trips."""
    relation_pattern = re.compile(r'\b(?:FROM|JOIN)\s+"jobs_job"')
    return sum(len(relation_pattern.findall(query['sql'])) for query in queries.captured_queries)


class PublicCompanyListQueryBudgetTests(APITestCase):
    def setUp(self):
        self.creator = get_user_model().objects.create_user(
            email='public-company-budget@example.com',
            password='Password@123',
            role='employer',
        )
        self.industry = Industry.objects.create(
            name='Public company budget',
            slug='public-company-budget',
        )

    def _company(self, index, *, featured):
        company = Company.objects.create(
            company_name=f'Công ty ngân sách {index:02d}',
            tax_code=f'01000000{index:02d}',
            created_by=self.creator,
            logo_url='https://cdn.example.com/logo.png' if featured else '',
            cover_image_url='https://cdn.example.com/cover.png' if featured else '',
        )
        if not featured:
            return company

        representative = get_user_model().objects.create_user(
            email=f'public-company-budget-{index}@example.com',
            password='Password@123',
            role='employer',
        )
        recruiter = RecruiterProfile.objects.create(
            user=representative,
            company=company,
            company_role=RecruiterProfile.CompanyRole.OWNER,
        )
        verification_case = EmployerVerificationCase.objects.create(
            recruiter=recruiter,
            company=company,
            verification_method=(EmployerVerificationCase.VerificationMethod.BUSINESS_REGISTRATION),
            status=EmployerVerificationCase.Status.APPROVED,
        )
        CompanyDocument.objects.create(
            company=company,
            recruiter=recruiter,
            uploaded_by=representative,
            verification_case=verification_case,
            doc_type=CompanyDocument.DocType.BUSINESS_REGISTRATION,
            file_url=f'companies/{company.pk}/business-registration.pdf',
            status=CompanyDocument.Status.APPROVED,
        )
        CompanyIndustry.objects.create(company=company, industry=self.industry)
        Job.objects.create(
            posted_by=representative,
            company=company,
            title=f'Việc làm ngân sách {index:02d}',
            description='Mô tả.',
            status=Job.Status.ACTIVE,
            published_at=timezone.now(),
            deadline=timezone.localdate() + timedelta(days=30),
        )
        return company

    def test_public_featured_company_query_count_stays_flat(self):
        self._company(0, featured=True)
        with CaptureQueriesContext(connection) as baseline_queries:
            baseline = self.client.get(reverse('public-company-list'))

        for index in range(1, 25):
            self._company(index, featured=True)
        with CaptureQueriesContext(connection) as expanded_queries:
            expanded = self.client.get(reverse('public-company-list'))

        self.assertEqual(baseline.status_code, 200, baseline.data)
        self.assertEqual(expanded.status_code, 200, expanded.data)
        self.assertEqual(len(baseline.data['results']), 1)
        self.assertEqual(len(expanded.data['results']), 18)
        self.assertNotIn('count', baseline.data)
        self.assertNotIn('count', expanded.data)
        self.assertEqual(len(baseline_queries), len(expanded_queries))
        self.assertLessEqual(len(expanded_queries), PUBLIC_COMPANY_LIST_QUERY_BUDGET)
        self.assertEqual(_canonical_job_table_references(baseline_queries), 1)
        self.assertEqual(_canonical_job_table_references(expanded_queries), 1)

    def test_public_company_search_query_count_stays_flat(self):
        self._company(0, featured=False)
        with CaptureQueriesContext(connection) as baseline_queries:
            baseline = self.client.get(reverse('public-company-list'), {'q': 'ngan sach'})

        for index in range(1, 25):
            self._company(index, featured=False)
        with CaptureQueriesContext(connection) as expanded_queries:
            expanded = self.client.get(reverse('public-company-list'), {'q': 'ngan sach'})

        self.assertEqual(baseline.status_code, 200, baseline.data)
        self.assertEqual(expanded.status_code, 200, expanded.data)
        self.assertEqual(len(baseline.data['results']), 1)
        self.assertEqual(len(expanded.data['results']), 18)
        self.assertEqual(baseline.data['count'], 1)
        self.assertEqual(expanded.data['count'], 25)
        self.assertEqual(len(baseline_queries), len(expanded_queries))
        self.assertLessEqual(len(expanded_queries), PUBLIC_COMPANY_LIST_QUERY_BUDGET)
        self.assertEqual(_canonical_job_table_references(baseline_queries), 1)
        self.assertEqual(_canonical_job_table_references(expanded_queries), 1)

    def test_public_company_search_cursor_page_omits_total_count_query(self):
        for index in range(25):
            self._company(index, featured=False)
        first = self.client.get(reverse('public-company-list'), {'q': 'ngan sach'})
        parsed_next = urlsplit(first.data['next'])

        with CaptureQueriesContext(connection) as cursor_queries:
            cursor_page = self.client.get(f'{parsed_next.path}?{parsed_next.query}')

        self.assertEqual(cursor_page.status_code, 200, cursor_page.data)
        self.assertNotIn('count', cursor_page.data)
        self.assertEqual(len(cursor_page.data['results']), 7)
        self.assertEqual(len(cursor_queries), 3)
        self.assertEqual(_canonical_job_table_references(cursor_queries), 1)


class RecruitmentNeedQueryBudgetTests(APITestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            email='need-budget@example.com',
            password='Password@123',
            role='employer',
            email_verified=True,
        )
        self.recruiter = RecruiterProfile.objects.create(
            user=self.user,
            registration_completed_at=timezone.now(),
        )
        category = JobCategory.objects.create(
            name='Recruitment need budget',
            category_type=JobCategory.CategoryType.SPECIALIZATION,
        )
        for index in range(5):
            RecruitmentNeed.objects.create(
                recruiter=self.recruiter,
                position_category=category,
                position_level=RecruitmentNeed.PositionLevel.EMPLOYEE,
                target_date=timezone.localdate() + timedelta(days=30 + index),
                headcount=index + 1,
                budget_source=RecruitmentNeed.BudgetSource.COMPANY,
                completed_at=timezone.now(),
            )
        self.client.force_authenticate(self.user)

    def test_onboarding_need_query_count_stays_flat(self):
        with self.assertNumQueries(RECRUITMENT_NEED_READ_BUDGET):
            response = self.client.get(reverse('employer-consulting-need'))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['position_category_name'], 'Recruitment need budget')

    def test_recruitment_need_list_query_count_stays_flat(self):
        with self.assertNumQueries(RECRUITMENT_NEED_READ_BUDGET):
            response = self.client.get(reverse('employer-recruitment-needs'))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 5)


class CompanyUpdateRequestQueryBudgetTests(APITestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            email='company-request-budget@example.com',
            password='Password@123',
            role='employer',
            email_verified=True,
        )
        self.company = Company.objects.create(
            company_name='Company request budget',
            tax_code='0109999999',
            created_by=self.user,
        )
        self.recruiter = RecruiterProfile.objects.create(
            user=self.user,
            company=self.company,
            company_role=RecruiterProfile.CompanyRole.OWNER,
        )
        self.client.force_authenticate(self.user)

    def _request_with_document(self, index):
        update_request = CompanyUpdateRequest.objects.create(
            company=self.company,
            requested_by=self.user,
            changes={'address': f'Địa chỉ {index}'},
            status=CompanyUpdateRequest.Status.APPROVED,
            submitted_at=timezone.now(),
        )
        CompanyDocument.objects.create(
            company=self.company,
            recruiter=self.recruiter,
            uploaded_by=self.user,
            update_request=update_request,
            doc_type=CompanyDocument.DocType.BUSINESS_REGISTRATION,
            file_url=f'employers/budget/document-{index}.pdf',
        )

    def test_company_update_request_list_query_count_stays_flat(self):
        self._request_with_document(1)
        with self.assertNumQueries(COMPANY_UPDATE_REQUEST_LIST_BUDGET):
            first = self.client.get(reverse('employer-company-update-requests'))
        self.assertEqual(first.status_code, 200)

        for index in range(2, 7):
            self._request_with_document(index)
        with self.assertNumQueries(COMPANY_UPDATE_REQUEST_LIST_BUDGET):
            expanded = self.client.get(reverse('employer-company-update-requests'))

        self.assertEqual(expanded.status_code, 200)
        self.assertEqual(len(expanded.data), 6)


class AdminCompanyUpdateRequestQueryBudgetTests(APITestCase):
    def setUp(self):
        self.admin = get_user_model().objects.create_superuser(
            email='company-request-admin-budget@example.com',
            password='Password@123',
        )
        self.client.force_authenticate(self.admin)

    def _request_with_document(self, index):
        requester = get_user_model().objects.create_user(
            email=f'company-request-admin-{index}@example.com',
            password='Password@123',
            role='employer',
        )
        company = Company.objects.create(
            company_name=f'Admin company request budget {index}',
            created_by=requester,
        )
        recruiter = RecruiterProfile.objects.create(
            user=requester,
            company=company,
            company_role=RecruiterProfile.CompanyRole.OWNER,
        )
        update_request = CompanyUpdateRequest.objects.create(
            company=company,
            requested_by=requester,
            changes={'address': f'Địa chỉ {index}'},
        )
        CompanyDocument.objects.create(
            company=company,
            recruiter=recruiter,
            uploaded_by=requester,
            update_request=update_request,
            doc_type=CompanyDocument.DocType.BUSINESS_REGISTRATION,
            file_url=f'employers/admin-budget/document-{index}.pdf',
        )

    def test_admin_company_update_request_list_query_count_stays_flat(self):
        self._request_with_document(1)
        with CaptureQueriesContext(connection) as first_queries:
            first = self.client.get(reverse('admin-company-update-request-list'))

        for index in range(2, 7):
            self._request_with_document(index)
        with CaptureQueriesContext(connection) as expanded_queries:
            expanded = self.client.get(reverse('admin-company-update-request-list'))

        self.assertEqual(first.status_code, 200, first.data)
        self.assertEqual(expanded.status_code, 200, expanded.data)
        self.assertEqual(first.data['count'], 1)
        self.assertEqual(expanded.data['count'], 6)
        self.assertEqual(len(first_queries), len(expanded_queries))
        self.assertLessEqual(
            len(expanded_queries),
            ADMIN_COMPANY_UPDATE_REQUEST_LIST_BUDGET,
        )
