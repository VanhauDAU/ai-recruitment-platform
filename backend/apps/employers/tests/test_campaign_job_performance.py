from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from apps.jobs.models import Job

from ..models import Company, RecruiterProfile, RecruitmentCampaign


class CampaignJobPerformanceTests(TestCase):
    def test_report_includes_rejection_reason_for_each_rejected_job(self):
        user = get_user_model().objects.create_user(
            email='campaign-rejected-job@example.com',
            password='password',
            role='employer',
        )
        company = Company.objects.create(company_name='Campaign Co', created_by=user)
        recruiter = RecruiterProfile.objects.create(user=user, company=company)
        campaign = RecruitmentCampaign.objects.create(
            owner=recruiter,
            company=company,
            name='Tuyển lập trình viên',
        )
        job = Job.objects.create(
            posted_by=user,
            company=company,
            campaign=campaign,
            title='Lập trình viên',
            description='Mô tả công việc.',
            status=Job.Status.REJECTED,
            rejected_reason='Thiếu thông tin mức lương.',
        )
        client = APIClient()
        client.force_authenticate(user)

        response = client.get(
            reverse('employer-campaign-job-performance', kwargs={'public_id': campaign.public_id})
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['jobs'][0]['public_id'], job.public_id)
        self.assertEqual(response.data['jobs'][0]['rejected_reason'], 'Thiếu thông tin mức lương.')
