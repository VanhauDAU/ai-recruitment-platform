"""Platform holds give the hidden display time back when they are lifted."""

from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from apps.accounts.tests.helpers import make_admin
from apps.employers.models import Company
from apps.employers.services import set_company_page_policy_hold
from apps.employers.tests.readiness_helpers import make_employer_ready

from ..models import Job, give_back_hidden_time
from .helpers import open_visibility_window


class HiddenTimeTests(TestCase):
    def setUp(self):
        employer = get_user_model().objects.create_user(
            email='hidden-owner@example.com', password='Password@123', role='employer'
        )
        self.company = Company.objects.create(company_name='Hidden Co', created_by=employer)
        make_employer_ready(employer, company=self.company, candidate_data=True)
        self.job = Job.objects.create(
            posted_by=employer,
            company=self.company,
            title='Hidden job',
            description='d',
            status=Job.Status.ACTIVE,
            **open_visibility_window(days=10),
        )
        self.admin = make_admin('hidden-admin@example.com')

    def test_only_the_window_left_at_the_hold_is_given_back(self):
        now = timezone.now()
        ends_at = self.job.visibility_ends_at
        expired = Job.objects.create(
            posted_by=self.job.posted_by,
            company=self.company,
            title='Already over',
            description='d',
            status=Job.Status.ACTIVE,
            visibility_starts_at=now - timedelta(days=30),
            visibility_ends_at=now - timedelta(days=20),
        )

        give_back_hidden_time(
            Job.objects.filter(company=self.company), since=now - timedelta(days=2), now=now
        )

        self.job.refresh_from_db()
        expired.refresh_from_db()
        self.assertEqual(self.job.visibility_ends_at, ends_at + timedelta(days=2))
        self.assertEqual(expired.visibility_ends_at, now - timedelta(days=20))

    def test_lifting_a_company_page_hold_restores_its_jobs_display_time(self):
        ends_at = self.job.visibility_ends_at
        with patch('django.utils.timezone.now', return_value=timezone.now() - timedelta(days=3)):
            set_company_page_policy_hold(
                self.company, actor=self.admin, hold=True, reason='Rà soát'
            )

        set_company_page_policy_hold(self.company, actor=self.admin, hold=False, reason='Xong')

        self.job.refresh_from_db()
        gained = self.job.visibility_ends_at - ends_at
        self.assertAlmostEqual(gained.total_seconds(), timedelta(days=3).total_seconds(), delta=60)
