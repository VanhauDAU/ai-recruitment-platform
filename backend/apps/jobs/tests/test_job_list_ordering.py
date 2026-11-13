"""Candidate feed ordering that depends only on admin-assigned job labels."""

from datetime import timedelta

from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.employers.models import Company
from apps.employers.tests.readiness_helpers import make_employer_ready

from ..models import Job


class OrganicJobListOrderingTests(APITestCase):
    def setUp(self):
        self.now = timezone.now()
        self.employer = User.objects.create_user(
            email='ordering@example.com',
            password='Password@123',
            role=User.Role.EMPLOYER,
        )
        self.company = Company.objects.create(company_name='Ordering Co', created_by=self.employer)
        make_employer_ready(self.employer, company=self.company, candidate_data=True)

    def create_job(self, title, *, tier=Job.Tier.STANDARD, age_days=0, salary=10_000_000):
        published_at = self.now - timedelta(days=age_days)
        return Job.objects.create(
            posted_by=self.employer,
            company=self.company,
            title=title,
            description='Description',
            salary_min=salary,
            salary_max=salary,
            salary_type=Job.SalaryType.FIXED,
            status=Job.Status.ACTIVE,
            tier=tier,
            deadline=timezone.localdate() + timedelta(days=30),
            first_approved_at=published_at,
            published_at=published_at,
        )

    def titles(self, url, params=None):
        response = self.client.get(url, {'page_size': 20, **(params or {})})
        self.assertEqual(response.status_code, 200, response.data)
        return [item['title'] for item in response.data['results']]

    def test_default_feed_orders_by_tier_then_most_recent_publication(self):
        self.create_job('Old standard', age_days=3)
        self.create_job('New standard', age_days=0)
        self.create_job('Old featured', tier=Job.Tier.FEATURED, age_days=5)
        self.create_job('New featured', tier=Job.Tier.FEATURED, age_days=1)
        self.create_job('Old top', tier=Job.Tier.TOP, age_days=9)

        self.assertEqual(
            self.titles(reverse('job-list')),
            ['Old top', 'New featured', 'Old featured', 'New standard', 'Old standard'],
        )

    def test_explicit_ordering_ignores_tier(self):
        self.create_job('Top low salary', tier=Job.Tier.TOP, salary=5_000_000)
        self.create_job('Standard high salary', salary=30_000_000, age_days=1)

        self.assertEqual(
            self.titles(reverse('job-list'), {'ordering': 'salary_desc'}),
            ['Standard high salary', 'Top low salary'],
        )
        self.assertEqual(
            self.titles(reverse('job-list'), {'ordering': 'newest'})[0],
            'Top low salary',
        )

    def test_homepage_best_jobs_admit_only_top_tier_jobs(self):
        self.create_job('Top one', tier=Job.Tier.TOP)
        self.create_job('Top two', tier=Job.Tier.TOP, age_days=2)
        self.create_job('Featured', tier=Job.Tier.FEATURED)
        self.create_job('Standard')

        self.assertEqual(
            set(self.titles(reverse('homepage-best-job-list'))),
            {'Top one', 'Top two'},
        )
