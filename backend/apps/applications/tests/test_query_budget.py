"""Hợp đồng số query cho danh sách đơn ứng tuyển của ứng viên (AR-P4).

Số query phải phẳng theo số bản ghi. Tăng budget phải kèm giải thích trong PR.
"""

from django.contrib.auth import get_user_model
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.urls import reverse
from rest_framework.test import APITestCase

from apps.accounts.services import issue_tokens
from apps.cv_templates.tests.factories import make_published_template
from apps.cvs.services import create_user_cv
from apps.employers.models import Company
from apps.employers.tests.factories import make_employer_ready
from apps.jobs.models import Job
from apps.jobs.tests.factories import open_visibility_window

from ..services import create_application_record

# 1 SELECT user (auth) + 1 SELECT auth session + 1 COUNT (pagination) +
# 1 SELECT applications (JOIN job/cv/version) + 1 prefetch preferred_locations
# + 1 prefetch status history for the candidate-visible timeline
# + 1 prefetch reminders (timeline entries and the remind action).
# +1: middleware bảo trì đọc cấu hình (ADR-0026).
CANDIDATE_APPLICATION_LIST_BUDGET = 7 + 1


class CandidateApplicationListQueryBudgetTests(APITestCase):
    def setUp(self):
        user_model = get_user_model()
        self.candidate = user_model.objects.create_user(
            email='budget-candidate@example.com',
            password='password',
            role='candidate',
            email_verified=True,
        )
        employer = user_model.objects.create_user(
            email='budget-employer@example.com', password='password', role='employer'
        )
        company = Company.objects.create(company_name='Budget Co', created_by=employer)
        make_employer_ready(employer, company=company, candidate_data=True)
        template, _version = make_published_template('Budget template')
        for index in range(3):
            job = Job.objects.create(
                posted_by=employer,
                company=company,
                title=f'Budget Job {index}',
                description='Description',
                status=Job.Status.ACTIVE,
                **open_visibility_window(),
            )
            cv = create_user_cv(actor=self.candidate, title=f'CV {index}', template=template)
            create_application_record(candidate=self.candidate, job=job, cv=cv)
        tokens = issue_tokens(self.candidate)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {tokens["access"]}')

    def test_candidate_application_list_query_count_is_flat(self):
        with self.assertNumQueries(CANDIDATE_APPLICATION_LIST_BUDGET):
            response = self.client.get(reverse('candidate-application-list-create'))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data['results']), 3)


class RecruiterApplicationListQueryBudgetTests(APITestCase):
    """`available_decisions` is computed in Python from loaded rows: no N+1."""

    def setUp(self):
        user_model = get_user_model()
        self.employer = user_model.objects.create_user(
            email='budget-recruiter@example.com', password='password', role='employer'
        )
        company = Company.objects.create(
            company_name='Recruiter Budget Co', created_by=self.employer
        )
        make_employer_ready(self.employer, company=company, candidate_data=True)
        self.job = Job.objects.create(
            posted_by=self.employer,
            company=company,
            title='Recruiter Budget Job',
            description='Description',
            status=Job.Status.ACTIVE,
            **open_visibility_window(),
        )
        self.template, _version = make_published_template('Recruiter budget template')
        tokens = issue_tokens(self.employer)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {tokens["access"]}')

    def add_applications(self, count, offset=0):
        for index in range(offset, offset + count):
            candidate = get_user_model().objects.create_user(
                email=f'budget-applicant-{index}@example.com',
                password='password',
                role='candidate',
                email_verified=True,
            )
            cv = create_user_cv(actor=candidate, title=f'CV {index}', template=self.template)
            create_application_record(candidate=candidate, job=self.job, cv=cv)

    def count_list_queries(self):
        with CaptureQueriesContext(connection) as queries:
            response = self.client.get(reverse('recruiter-application-list'))
        self.assertEqual(response.status_code, 200)
        return len(queries)

    def test_recruiter_application_list_query_count_is_flat(self):
        self.add_applications(1)
        single = self.count_list_queries()
        self.add_applications(2, offset=1)

        self.assertEqual(self.count_list_queries(), single)
