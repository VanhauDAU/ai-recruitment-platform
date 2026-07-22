from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.employers.models import Company

from ..models import Job, JobStatusHistory


class JobModerationApiTests(APITestCase):
    def setUp(self):
        user_model = get_user_model()
        self.employer = user_model.objects.create_user(
            email='job-owner@example.com', password='Password@123', role=user_model.Role.EMPLOYER
        )
        self.admin = user_model.objects.create_user(
            email='job-admin@example.com', password='Password@123', role=user_model.Role.ADMIN
        )
        company = Company.objects.create(company_name='Moderation Co', created_by=self.employer)
        self.job = Job.objects.create(
            posted_by=self.employer,
            company=company,
            title='Backend Engineer',
            description='Xây dựng nền tảng tuyển dụng.',
            status=Job.Status.PENDING,
            submitted_at=timezone.now(),
        )

    def review_url(self):
        return reverse('admin-job-review', kwargs={'public_id': self.job.public_id})

    def test_admin_approves_pending_job_and_makes_it_public(self):
        self.client.force_authenticate(self.admin)

        response = self.client.post(self.review_url(), {'action': 'approve'}, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.job.refresh_from_db()
        self.assertEqual(self.job.status, Job.Status.ACTIVE)
        self.assertIsNotNone(self.job.approved_at)
        self.assertIsNotNone(self.job.published_at)
        history = self.job.status_history.get()
        self.assertEqual(history.actor_role, JobStatusHistory.ActorRole.ADMIN)
        self.assertEqual(history.to_status, Job.Status.ACTIVE)

    def test_rejection_requires_reason_and_employer_can_read_it(self):
        self.client.force_authenticate(self.admin)

        missing_reason = self.client.post(self.review_url(), {'action': 'reject'}, format='json')
        self.assertEqual(missing_reason.status_code, status.HTTP_400_BAD_REQUEST)

        response = self.client.post(
            self.review_url(),
            {'action': 'reject', 'reason': 'Vui lòng bổ sung mô tả quyền lợi và mức lương.'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.job.refresh_from_db()
        self.assertEqual(self.job.status, Job.Status.REJECTED)
        self.assertEqual(self.job.rejected_reason, 'Vui lòng bổ sung mô tả quyền lợi và mức lương.')
        self.assertIsNone(self.job.published_at)

        self.client.force_authenticate(self.employer)
        detail = self.client.get(
            reverse('employer-job-detail', kwargs={'public_id': self.job.public_id})
        )
        self.assertEqual(detail.status_code, status.HTTP_200_OK, detail.data)
        self.assertEqual(detail.data['status'], Job.Status.REJECTED)
        self.assertEqual(detail.data['rejected_reason'], self.job.rejected_reason)

    def test_non_admin_cannot_review_jobs(self):
        self.client.force_authenticate(self.employer)

        response = self.client.get(reverse('admin-job-moderation-list'))

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
