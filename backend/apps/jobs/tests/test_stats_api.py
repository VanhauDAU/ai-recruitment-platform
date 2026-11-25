from django.urls import reverse
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.employers.models import Company
from apps.employers.tests.factories import make_employer_ready

from ..models import Job, JobCategory, JobCategoryAssignment
from .factories import open_visibility_window


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
                **open_visibility_window(),
            )
        Company.objects.filter(pk=companies['Held Co'].pk).update(content_policy_hold=True)

        response = self.client.get(reverse('job-stats'))

        # A held company page also takes its jobs off the public site.
        self.assertEqual(response.data['active_jobs'], 1)
        self.assertEqual(
            [item['slug'] for item in response.data['featured_employers']],
            [companies['Visible Co'].slug],
        )

    def test_category_demand_rolls_descendants_up_to_top_groups(self):
        employer = User.objects.create_user(
            email='demand-stats@example.com',
            password='Password@123',
            role=User.Role.EMPLOYER,
        )
        company = Company.objects.create(company_name='Demand Co', created_by=employer)
        make_employer_ready(employer, company=company, candidate_data=True)
        it = JobCategory.objects.create(name='CNTT', logo_url='jobs/categories/logos/it.webp')
        web = JobCategory.objects.create(name='Web', parent=it)
        backend = JobCategory.objects.create(name='Backend', parent=web)
        sales = JobCategory.objects.create(name='Sales')
        JobCategory.objects.create(name='Empty group')

        def job(title, *categories):
            created = Job.objects.create(
                posted_by=employer,
                company=company,
                title=title,
                description='Description',
                status=Job.Status.ACTIVE,
                **open_visibility_window(),
            )
            for category in categories:
                JobCategoryAssignment.objects.create(job=created, category=category)

        job('Backend dev', backend, web)  # two IT categories, counted once
        job('IT lead', it)
        job('Sales rep', sales)

        response = self.client.get(reverse('job-stats'))

        demand = {item['name']: item for item in response.data['demand']}
        self.assertEqual(list(demand), ['CNTT', 'Sales'])
        self.assertEqual(demand['CNTT']['count'], 2)
        self.assertEqual(demand['Sales']['count'], 1)
        self.assertTrue(demand['CNTT']['logo_url'].endswith('/jobs/categories/logos/it.webp'))
