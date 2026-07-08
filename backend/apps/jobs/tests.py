from django.urls import reverse
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.employers.models import EmployerProfile

from .models import Job


class JobSalaryBucketFilterTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email='employer@example.com',
            password='Password@123',
            role=User.Role.EMPLOYER,
        )
        self.profile = EmployerProfile.objects.create(user=self.user, company_name='Acme')

    def create_job(self, title, salary_min, salary_max):
        return Job.objects.create(
            employer=self.user,
            employer_profile=self.profile,
            title=title,
            description='Description',
            salary_min=salary_min,
            salary_max=salary_max,
            status=Job.Status.ACTIVE,
        )

    def test_homepage_under_10_bucket_uses_displayed_upper_salary(self):
        self.create_job('Under 10', 5_000_000, 9_000_000)
        self.create_job('Crosses 10', 8_000_000, 13_000_000)
        self.create_job('Starts at 10', 10_000_000, 25_000_000)

        response = self.client.get(reverse('job-list'), {'salary_bucket': 'u10'})

        self.assertEqual(response.status_code, 200)
        titles = {job['title'] for job in response.data['results']}
        self.assertEqual(titles, {'Under 10'})
