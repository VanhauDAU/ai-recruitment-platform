from concurrent.futures import ThreadPoolExecutor
from threading import Barrier

from django.contrib.auth import get_user_model
from django.db import close_old_connections
from django.test import TransactionTestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.test import APITestCase

from apps.accounts.models import AdminPermission, AdminRole, Department
from apps.accounts.services import assign_membership
from apps.employers.models import Company

from ..models import Job, JobModerationEvent, JobStatusHistory
from ..services import approve_job, reject_job


class JobModerationApiTests(APITestCase):
    def setUp(self):
        user_model = get_user_model()
        self.employer = user_model.objects.create_user(
            email='job-owner@example.com', password='Password@123', role=user_model.Role.EMPLOYER
        )
        self.admin = user_model.objects.create_user(
            email='job-admin@example.com',
            password='Password@123',
            role=user_model.Role.ADMIN,
        )
        department = Department.objects.create(
            code='job-moderation',
            name='Kiểm duyệt tin',
        )
        role = AdminRole.objects.create(
            department=department,
            code='staff',
            name='Nhân viên',
        )
        role.permissions.add(
            *[
                AdminPermission.objects.create(
                    code=code,
                    module='job_moderation',
                    label=code,
                )
                for code in (
                    'job_moderation.view',
                    'job_moderation.approve',
                    'job_moderation.reject',
                    'job_moderation.enforce_visibility',
                    'job_moderation.view_sensitive_contact',
                )
            ]
        )
        assign_membership(self.admin, role, actor=self.admin)
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

    def detail_url(self):
        return reverse(
            'admin-job-moderation-detail',
            kwargs={'public_id': self.job.public_id},
        )

    def decision_url(self):
        return reverse('admin-job-decision', kwargs={'public_id': self.job.public_id})

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

    def test_stale_pending_instance_cannot_override_a_completed_review(self):
        stale_job = Job.objects.get(pk=self.job.pk)

        approve_job(job=self.job, user=self.admin)
        with self.assertRaises(ValidationError):
            reject_job(job=stale_job, user=self.admin, reason='Stale rejection')

        self.job.refresh_from_db()
        self.assertEqual(self.job.status, Job.Status.ACTIVE)
        self.assertEqual(self.job.status_history.count(), 1)

    def test_management_list_summary_and_detail_return_operational_read_models(self):
        self.client.force_authenticate(self.admin)

        listing = self.client.get(
            reverse('admin-job-moderation-list'),
            {'q': 'Backend', 'status': 'pending', 'ordering': 'title'},
        )
        summary = self.client.get(reverse('admin-job-moderation-summary'))
        detail = self.client.get(self.detail_url())

        self.assertEqual(listing.status_code, status.HTTP_200_OK, listing.data)
        self.assertEqual(listing.data['count'], 1)
        self.assertEqual(listing.data['results'][0]['public_id'], self.job.public_id)
        self.assertEqual(listing.data['results'][0]['pending_report_count'], 0)
        self.assertEqual(summary.status_code, status.HTTP_200_OK, summary.data)
        self.assertEqual(summary.data['total'], 1)
        self.assertEqual(summary.data['pending'], 1)
        self.assertEqual(detail.status_code, status.HTTP_200_OK, detail.data)
        self.assertEqual(detail.data['public_id'], self.job.public_id)
        self.assertIn('approve', detail.data['state_actions'])
        self.assertTrue(detail.data['review_token'])
        self.assertIn('moderation_events', detail.data)

    def test_decision_endpoint_rejects_a_stale_preview(self):
        self.client.force_authenticate(self.admin)
        detail = self.client.get(self.detail_url())
        token = detail.data['review_token']
        self.job.title = 'Backend Engineer — revised'
        self.job.save(update_fields=['title', 'updated_at'])

        response = self.client.post(
            self.decision_url(),
            {'action': 'approve', 'review_token': token},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT, response.data)
        self.job.refresh_from_db()
        self.assertEqual(self.job.status, Job.Status.PENDING)
        self.assertFalse(self.job.moderation_events.exists())

    def test_admin_can_hide_and_restore_an_active_job_without_changing_business_status(self):
        now = timezone.now()
        self.job.status = Job.Status.ACTIVE
        self.job.approved_at = now
        self.job.published_at = now
        self.job.save(update_fields=['status', 'approved_at', 'published_at', 'updated_at'])
        self.client.force_authenticate(self.admin)
        visible_before = self.client.get(reverse('job-list'))
        token = self.client.get(self.detail_url()).data['review_token']

        hidden = self.client.post(
            self.decision_url(),
            {
                'action': 'hide',
                'review_token': token,
                'reason_code': 'fraud_risk',
                'hold': Job.ModerationHold.MANUAL_REVIEW,
                'note': 'Cần xác minh lại nội dung trước khi tiếp tục hiển thị.',
            },
            format='json',
        )

        self.assertEqual(hidden.status_code, status.HTTP_200_OK, hidden.data)
        self.job.refresh_from_db()
        self.assertEqual(self.job.status, Job.Status.ACTIVE)
        self.assertEqual(self.job.moderation_hold, Job.ModerationHold.MANUAL_REVIEW)
        hidden_public_list = self.client.get(reverse('job-list'))
        hidden_public_detail = self.client.get(
            reverse('job-detail', kwargs={'slug': self.job.slug})
        )
        self.assertEqual(visible_before.data['count'], 1)
        self.assertEqual(hidden_public_list.data['count'], 0)
        self.assertEqual(hidden_public_detail.status_code, status.HTTP_404_NOT_FOUND)
        self.assertFalse(
            Job.objects.filter(pk=self.job.pk, moderation_hold=Job.ModerationHold.NONE).exists()
        )

        restored = self.client.post(
            self.decision_url(),
            {
                'action': 'restore',
                'review_token': hidden.data['review_token'],
                'note': 'Đã xác minh nội dung hợp lệ.',
            },
            format='json',
        )

        self.assertEqual(restored.status_code, status.HTTP_200_OK, restored.data)
        self.job.refresh_from_db()
        self.assertEqual(self.job.status, Job.Status.ACTIVE)
        self.assertEqual(self.job.moderation_hold, Job.ModerationHold.NONE)
        restored_public_list = self.client.get(reverse('job-list'))
        self.assertEqual(restored_public_list.data['count'], 1)
        self.assertEqual(
            list(self.job.moderation_events.values_list('action', flat=True)),
            [JobModerationEvent.Action.RESTORE, JobModerationEvent.Action.HIDE],
        )


class JobModerationConcurrencyTests(TransactionTestCase):
    def setUp(self):
        user_model = get_user_model()
        self.employer = user_model.objects.create_user(
            email='concurrent-job-owner@example.com',
            password='Password@123',
            role=user_model.Role.EMPLOYER,
        )
        self.admin = user_model.objects.create_user(
            email='concurrent-job-admin@example.com',
            password='Password@123',
            role=user_model.Role.ADMIN,
        )
        company = Company.objects.create(
            company_name='Concurrent Moderation Co',
            created_by=self.employer,
        )
        self.job = Job.objects.create(
            posted_by=self.employer,
            company=company,
            title='Concurrent Backend Engineer',
            description='Exercise the moderation row lock.',
            status=Job.Status.PENDING,
            submitted_at=timezone.now(),
        )

    def test_simultaneous_approvals_record_exactly_one_transition(self):
        gate = Barrier(2)

        def approve_once():
            close_old_connections()
            try:
                stale_job = Job.objects.get(pk=self.job.pk)
                gate.wait(timeout=5)
                try:
                    approve_job(job=stale_job, user=self.admin)
                except ValidationError:
                    return 'already-reviewed'
                return 'approved'
            finally:
                close_old_connections()

        with ThreadPoolExecutor(max_workers=2) as pool:
            outcomes = list(pool.map(lambda _: approve_once(), range(2)))

        self.assertCountEqual(outcomes, ['approved', 'already-reviewed'])
        self.job.refresh_from_db()
        self.assertEqual(self.job.status, Job.Status.ACTIVE)
        self.assertEqual(self.job.status_history.count(), 1)
