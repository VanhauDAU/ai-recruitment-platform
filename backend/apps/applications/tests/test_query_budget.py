"""Hợp đồng số query cho danh sách đơn ứng tuyển của ứng viên (AR-P4).

Số query phải phẳng theo số bản ghi. Tăng budget phải kèm giải thích trong PR.
"""

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APITestCase

from apps.accounts.services.tokens import issue_tokens
from apps.cv_templates.tests.factories import make_published_template
from apps.cvs.services import create_v2_cv
from apps.employers.models import Company
from apps.jobs.models import Job

from ..services import create_application_record

# 1 SELECT user (auth) + 1 SELECT auth session + 1 COUNT (pagination) +
# 1 SELECT applications (JOIN job/cv/version) + 1 prefetch preferred_locations.
CANDIDATE_APPLICATION_LIST_BUDGET = 5


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
        template, _version = make_published_template('Budget template')
        for index in range(3):
            job = Job.objects.create(
                posted_by=employer,
                company=company,
                title=f'Budget Job {index}',
                description='Description',
                status=Job.Status.ACTIVE,
            )
            cv = create_v2_cv(actor=self.candidate, title=f'CV {index}', template=template)
            create_application_record(candidate=self.candidate, job=job, cv=cv)
        tokens = issue_tokens(self.candidate)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {tokens["access"]}')

    def test_candidate_application_list_query_count_is_flat(self):
        with self.assertNumQueries(CANDIDATE_APPLICATION_LIST_BUDGET):
            response = self.client.get(reverse('candidate-application-list-create-v2'))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data['results']), 3)
