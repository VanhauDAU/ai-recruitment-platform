"""Organic, single-clock ordering of every public job surface (ADR-0030)."""

from datetime import timedelta

from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.employers.models import Company
from apps.employers.tests.factories import make_employer_ready

from ..models import Job
from .factories import open_visibility_window


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

    def create_job(self, title, *, age_days=0, salary=10_000_000, deadline_days=30):
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
            deadline=timezone.localdate() + timedelta(days=deadline_days),
            first_approved_at=published_at,
            published_at=published_at,
            **open_visibility_window(),
        )

    def reopen_now(self, job):
        """What reopening leaves behind: a fresh ``published_at``, first approval kept."""
        Job.objects.filter(pk=job.pk).update(published_at=self.now)

    def titles(self, url, params=None):
        response = self.client.get(url, {'page_size': 20, **(params or {})})
        self.assertEqual(response.status_code, 200, response.data)
        return [item['title'] for item in response.data['results']]

    def test_default_feed_is_newest_first_publication(self):
        self.create_job('Old', age_days=9)
        self.create_job('New', age_days=0)
        self.create_job('Middle', age_days=3)

        self.assertEqual(self.titles(reverse('job-list')), ['New', 'Middle', 'Old'])
        self.assertEqual(
            self.titles(reverse('job-list'), {'ordering': 'newest'}), ['New', 'Middle', 'Old']
        )

    def test_salary_ordering_puts_highest_first(self):
        self.create_job('Low salary', salary=5_000_000)
        self.create_job('High salary', salary=30_000_000, age_days=1)

        self.assertEqual(
            self.titles(reverse('job-list'), {'ordering': 'salary_desc'}),
            ['High salary', 'Low salary'],
        )

    def test_closing_soon_ordering_puts_nearest_deadline_first(self):
        self.create_job('Closes in a month', deadline_days=30)
        self.create_job('Closes in two days', deadline_days=2, age_days=5)
        self.create_job('Closes in a week', deadline_days=7)

        self.assertEqual(
            self.titles(reverse('job-list'), {'ordering': 'closing_soon'}),
            ['Closes in two days', 'Closes in a week', 'Closes in a month'],
        )

    def test_retired_urgent_ordering_is_rejected(self):
        response = self.client.get(reverse('job-list'), {'ordering': 'urgent'})

        self.assertEqual(response.status_code, 400)

    def test_reopened_job_keeps_its_place_on_every_surface(self):
        reopened = self.create_job('Reopened old job', age_days=40)
        self.create_job('Fresh job', age_days=1)
        self.reopen_now(reopened)

        self.assertEqual(self.titles(reverse('job-list')), ['Fresh job', 'Reopened old job'])
        self.assertEqual(
            self.titles(reverse('homepage-best-job-list')), ['Fresh job', 'Reopened old job']
        )
        stats = self.client.get(reverse('job-stats')).data
        self.assertEqual(
            [job['title'] for job in stats['latest_jobs']], ['Fresh job', 'Reopened old job']
        )
        self.assertEqual(stats['new_jobs_24h'], 0)

    def test_homepage_best_jobs_rank_every_active_job_by_quality(self):
        hidden = self.create_job('Salary hidden, this week', age_days=1)
        Job.objects.filter(pk=hidden.pk).update(salary_type=Job.SalaryType.NEGOTIABLE)
        self.create_job('Salary, old', age_days=40)
        self.create_job('Salary, this month', age_days=20)
        fast = self.create_job('Salary, old, fast response', age_days=40)
        Job.objects.filter(pk=fast.pk).update(has_flash_badge=True)

        self.assertEqual(
            self.titles(reverse('homepage-best-job-list')),
            [
                'Salary, old, fast response',
                'Salary, this month',
                'Salary, old',
                'Salary hidden, this week',
            ],
        )

    def test_homepage_best_jobs_rotate_jobs_with_the_same_score(self):
        for index in range(6):
            self.create_job(f'Same score {index}')
        url = reverse('homepage-best-job-list')

        first = self.titles(url, {'rotation_seed': 'visit-a'})
        again = self.titles(url, {'rotation_seed': 'visit-a'})
        other = self.titles(url, {'rotation_seed': 'visit-b'})

        self.assertEqual(first, again)
        self.assertEqual(set(first), set(other))
        self.assertNotEqual(first, other)
