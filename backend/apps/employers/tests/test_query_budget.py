"""Query-count contracts for employer recruitment-need reads."""

from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.jobs.models import JobCategory

from ..models import (
    Company,
    CompanyDocument,
    CompanyUpdateRequest,
    RecruiterProfile,
    RecruitmentNeed,
)

# Authentication is bypassed with force_authenticate: one recruiter lookup plus
# one recruitment-need SELECT. The count must remain flat as rows are added.
RECRUITMENT_NEED_READ_BUDGET = 2
COMPANY_UPDATE_REQUEST_LIST_BUDGET = 4
ADMIN_COMPANY_UPDATE_REQUEST_LIST_BUDGET = 8


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
