from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from apps.jobs.models import Job

from ..models import Company, RecruitmentCampaign
from .readiness_helpers import make_employer_ready


class CampaignJobPerformanceTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            email='campaign-job-performance@example.com',
            password='password',
            role='employer',
        )
        self.company = Company.objects.create(company_name='Campaign Co', created_by=self.user)
        recruiter = make_employer_ready(self.user, company=self.company)
        self.campaign = RecruitmentCampaign.objects.create(
            owner=recruiter,
            company=self.company,
            name='Tuyển lập trình viên',
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def make_job(self, **overrides):
        return Job.objects.create(
            posted_by=self.user,
            company=self.company,
            campaign=self.campaign,
            title='Lập trình viên',
            description='Mô tả công việc.',
            **overrides,
        )

    def report_jobs(self):
        response = self.client.get(
            reverse(
                'employer-campaign-job-performance',
                kwargs={'public_id': self.campaign.public_id},
            )
        )
        self.assertEqual(response.status_code, 200, response.data)
        return {job['public_id']: job for job in response.data['jobs']}

    def test_report_lists_draft_jobs_without_the_retired_rejection_reason(self):
        job = self.make_job(status=Job.Status.DRAFT)

        reported = self.report_jobs()[job.public_id]

        self.assertEqual(reported['status'], Job.Status.DRAFT)
        self.assertNotIn('rejected_reason', reported)

    def test_report_flags_jobs_hidden_from_candidates(self):
        visible = self.make_job(status=Job.Status.ACTIVE)
        hidden = self.make_job(
            status=Job.Status.ACTIVE,
            moderation_hold=Job.ModerationHold.MANUAL_REVIEW,
        )
        account_held = self.make_job(
            status=Job.Status.ACTIVE,
            policy_hold=Job.PolicyHold.BAN_REVIEW,
        )

        reported = self.report_jobs()

        self.assertFalse(reported[visible.public_id]['visibility_held'])
        self.assertTrue(reported[hidden.public_id]['visibility_held'])
        self.assertTrue(reported[account_held.public_id]['visibility_held'])
