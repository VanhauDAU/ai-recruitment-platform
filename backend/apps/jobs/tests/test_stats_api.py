from django.urls import reverse
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.employers.models import Company
from apps.employers.tests.readiness_helpers import make_employer_ready

from ..models import Job


class JobStatsApiTests(APITestCase):
    def test_platform_account_totals_only_include_active_non_deleted_accounts(self):
        User.objects.create_user(
            email='active-candidate@example.com',
            password='Password@123',
            role=User.Role.CANDIDATE,
        )
        User.objects.create_user(
            email='deleted-candidate@example.com',
            password='Password@123',
            role=User.Role.CANDIDATE,
            is_deleted=True,
        )
        User.objects.create_user(
            email='active-employer@example.com',
            password='Password@123',
            role=User.Role.EMPLOYER,
        )
        User.objects.create_user(
            email='inactive-employer@example.com',
            password='Password@123',
            role=User.Role.EMPLOYER,
            is_active=False,
            status=User.Status.INACTIVE,
        )

        response = self.client.get(reverse('job-stats'))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['candidates'], 1)
        self.assertEqual(response.data['employers'], 1)

    def test_featured_employers_skip_companies_whose_page_is_held(self):
        companies = {}
        for name in ('Visible Co', 'Held Co'):
            employer = User.objects.create_user(
                email=f'{name.split()[0].lower()}-stats@example.com',
                password='Password@123',
                role=User.Role.EMPLOYER,
            )
            companies[name] = Company.objects.create(company_name=name, created_by=employer)
            make_employer_ready(employer, company=companies[name], candidate_data=True)
            Job.objects.create(
                posted_by=employer,
                company=companies[name],
                title=f'{name} job',
                description='Description',
                status=Job.Status.ACTIVE,
            )
        Company.objects.filter(pk=companies['Held Co'].pk).update(content_policy_hold=True)

        response = self.client.get(reverse('job-stats'))

        self.assertEqual(response.data['active_jobs'], 2)
        self.assertEqual(
            [item['slug'] for item in response.data['featured_employers']],
            [companies['Visible Co'].slug],
        )
