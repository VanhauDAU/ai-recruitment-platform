from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from threading import Barrier, Event
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.db import close_old_connections, transaction
from django.test import TransactionTestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.test import APITestCase

from apps.accounts.models import AdminPermission, AdminRole, Department
from apps.accounts.services import assign_membership
from apps.employers.models import (
    Company,
    EmployerVerificationCase,
    RecruitmentCampaign,
)
from apps.employers.services import recruiter_job_approval_state
from apps.employers.tests.readiness_helpers import make_employer_ready

from ..models import (
    Job,
    JobApplicationContact,
    JobApplicationEmail,
    JobModerationEvent,
    JobStatusHistory,
)
from ..services import JobModerationStale, approve_job, reject_job


def make_approvable_recruiter(*, employer, company):
    recruiter = make_employer_ready(
        employer,
        company=company,
        candidate_data=True,
    )
    return recruiter, recruiter.verification_case


class JobModerationFixture:
    """One pending job plus the two reviewer profiles the suites compare."""

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
        self.restricted_admin = user_model.objects.create_user(
            email='job-admin-restricted@example.com',
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
        permissions = {
            code: AdminPermission.objects.create(code=code, module='job_moderation', label=code)
            for code in (
                'job_moderation.view',
                'job_moderation.approve',
                'job_moderation.reject',
                'job_moderation.enforce_visibility',
                'job_moderation.view_sensitive_contact',
            )
        }
        role.permissions.add(*permissions.values())
        restricted_role = AdminRole.objects.create(
            department=department,
            code='staff-restricted',
            name='Nhân viên hạn chế',
        )
        restricted_role.permissions.add(
            *[
                permission
                for code, permission in permissions.items()
                if code != 'job_moderation.view_sensitive_contact'
            ]
        )
        assign_membership(self.admin, role, actor=self.admin)
        assign_membership(self.restricted_admin, restricted_role, actor=self.admin)
        company = Company.objects.create(company_name='Moderation Co', created_by=self.employer)
        self.company = company
        self.recruiter, self.verification_case = make_approvable_recruiter(
            employer=self.employer,
            company=company,
        )
        self.job = Job.objects.create(
            posted_by=self.employer,
            company=company,
            title='Backend Engineer',
            description='Xây dựng nền tảng tuyển dụng.',
            status=Job.Status.PENDING,
            submitted_at=timezone.now(),
        )


class JobModerationApiTests(JobModerationFixture, APITestCase):
    def review_url(self):
        return reverse('admin-job-review', kwargs={'public_id': self.job.public_id})

    def detail_url(self):
        return reverse(
            'admin-job-moderation-detail',
            kwargs={'public_id': self.job.public_id},
        )

    def decision_url(self):
        return reverse('admin-job-decision', kwargs={'public_id': self.job.public_id})

    def test_deleted_campaign_from_stale_preview_returns_conflict_not_server_error(self):
        campaign = RecruitmentCampaign.objects.create(
            owner=self.recruiter,
            company=self.company,
            name='Campaign deleted during review',
        )
        self.job.campaign = campaign
        self.job.save(update_fields=['campaign', 'updated_at'])
        stale_job = Job.objects.select_related('posted_by', 'campaign').get(pk=self.job.pk)
        campaign.delete()

        with self.assertRaises(JobModerationStale):
            approve_job(job=stale_job, user=self.admin)

    def test_admin_approves_pending_job_and_makes_it_public(self):
        self.client.force_authenticate(self.admin)

        response = self.client.post(self.review_url(), {'action': 'approve'}, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.job.refresh_from_db()
        self.assertEqual(self.job.status, Job.Status.ACTIVE)
        self.assertIsNotNone(self.job.approved_at)
        self.assertIsNotNone(self.job.published_at)
        self.assertEqual(self.job.first_approved_at, self.job.approved_at)
        self.assertEqual(self.job.visibility_starts_at, self.job.first_approved_at)
        self.assertEqual(
            self.job.visibility_ends_at,
            self.job.visibility_starts_at + timedelta(days=30),
        )
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
        with patch(
            'apps.jobs.services.moderation.recruiter_job_approval_state',
            wraps=recruiter_job_approval_state,
        ) as approval_state:
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
        self.assertEqual(approval_state.call_count, 1)

    def test_management_list_filters_jobs_by_company_public_id(self):
        other_company = Company.objects.create(
            company_name='Other Job Company',
            created_by=self.employer,
        )
        other_job = Job.objects.create(
            posted_by=self.employer,
            company=other_company,
            title='Job from another company',
            status=Job.Status.DRAFT,
        )
        self.client.force_authenticate(self.admin)

        response = self.client.get(
            reverse('admin-job-moderation-list'),
            {'company': self.company.public_id, 'ordering': '-updated_at'},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(
            [item['public_id'] for item in response.data['results']],
            [str(self.job.public_id)],
        )
        self.assertNotEqual(str(other_job.public_id), response.data['results'][0]['public_id'])

    def test_management_list_defaults_to_newest_created_with_a_stable_tie_breaker(self):
        first_newest = Job.objects.create(
            posted_by=self.employer,
            company=self.company,
            title='Newest A',
            status=Job.Status.PENDING,
            submitted_at=timezone.now(),
        )
        second_newest = Job.objects.create(
            posted_by=self.employer,
            company=self.company,
            title='Newest B',
            status=Job.Status.PENDING,
            submitted_at=timezone.now(),
        )
        newest_at = timezone.now()
        Job.objects.filter(pk__in=[first_newest.pk, second_newest.pk]).update(created_at=newest_at)
        Job.objects.filter(pk=self.job.pk).update(created_at=newest_at - timedelta(days=1))
        self.client.force_authenticate(self.admin)

        default_response = self.client.get(reverse('admin-job-moderation-list'))
        invalid_response = self.client.get(
            reverse('admin-job-moderation-list'),
            {'ordering': 'unsupported'},
        )
        expected = [second_newest.public_id, first_newest.public_id, self.job.public_id]

        for response in (default_response, invalid_response):
            with self.subTest(path=response.request['QUERY_STRING']):
                self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
                self.assertEqual(
                    [item['public_id'] for item in response.data['results']],
                    [str(public_id) for public_id in expected],
                )
                self.assertTrue(response.data['results'][0]['created_at'])

    def test_unapproved_verification_blocks_canonical_and_compatibility_approval(self):
        self.verification_case.status = EmployerVerificationCase.Status.IN_REVIEW
        self.verification_case.save(update_fields=['status', 'updated_at'])
        self.client.force_authenticate(self.admin)

        detail = self.client.get(self.detail_url())
        canonical = self.client.post(
            self.decision_url(),
            {'action': 'approve', 'review_token': detail.data['review_token']},
            format='json',
        )
        compatibility = self.client.post(
            self.review_url(),
            {'action': 'approve'},
            format='json',
        )

        self.assertNotIn('approve', detail.data['state_actions'])
        self.assertEqual(
            [item['code'] for item in detail.data['approve_blockers']],
            ['verification_required'],
        )
        for response in (canonical, compatibility):
            with self.subTest(path=response.request['PATH_INFO']):
                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST, response.data)
                self.assertEqual(response.data['code'], 'JOB_APPROVAL_BLOCKED')
                self.assertEqual(
                    [item['code'] for item in response.data['blocked_reasons']],
                    ['verification_required'],
                )
        self.job.refresh_from_db()
        self.assertEqual(self.job.status, Job.Status.PENDING)
        self.assertFalse(self.job.moderation_events.exists())

    def test_missing_dpa_and_company_mismatch_are_fail_closed(self):
        self.recruiter.dpa_accepted_at = None
        self.recruiter.save(update_fields=['dpa_accepted_at', 'updated_at'])
        other_company = Company.objects.create(
            company_name='Other Moderation Co',
            created_by=self.employer,
        )
        self.verification_case.company = other_company
        self.verification_case.save(update_fields=['company', 'updated_at'])
        self.client.force_authenticate(self.admin)

        detail = self.client.get(self.detail_url())

        self.assertNotIn('approve', detail.data['state_actions'])
        self.assertEqual(
            [item['code'] for item in detail.data['approve_blockers']],
            ['verification_required', 'dpa_outdated'],
        )
        blocker_codes = [item['code'] for item in detail.data['blocked_reasons']]
        self.assertEqual(len(blocker_codes), len(set(blocker_codes)))

        response = self.client.post(
            self.decision_url(),
            {'action': 'approve', 'review_token': detail.data['review_token']},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST, response.data)
        self.assertEqual(response.data['code'], 'JOB_APPROVAL_BLOCKED')
        error_codes = [item['code'] for item in response.data['blocked_reasons']]
        self.assertEqual(error_codes, ['verification_required', 'dpa_outdated'])
        self.assertEqual(len(error_codes), len(set(error_codes)))

    def test_campaign_change_after_preview_is_rechecked_without_relying_on_job_token(self):
        campaign = RecruitmentCampaign.objects.create(
            owner=self.recruiter,
            company=self.company,
            name='Backend hiring',
            status=RecruitmentCampaign.Status.ACTIVE,
        )
        self.job.campaign = campaign
        self.job.save(update_fields=['campaign', 'updated_at'])
        self.client.force_authenticate(self.admin)
        detail = self.client.get(self.detail_url())
        campaign.status = RecruitmentCampaign.Status.PAUSED
        campaign.save(update_fields=['status', 'updated_at'])

        response = self.client.post(
            self.decision_url(),
            {'action': 'approve', 'review_token': detail.data['review_token']},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST, response.data)
        self.assertEqual(response.data['code'], 'JOB_APPROVAL_BLOCKED')
        self.assertIn(
            'campaign_inactive',
            [item['code'] for item in response.data['blocked_reasons']],
        )
        self.job.refresh_from_db()
        self.assertEqual(self.job.status, Job.Status.PENDING)

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


class JobRevisionReviewTests(JobModerationFixture, APITestCase):
    """A revision of an approved job must be reviewable against its baseline."""

    def detail_url(self):
        return reverse(
            'admin-job-moderation-detail',
            kwargs={'public_id': self.job.public_id},
        )

    def decision_url(self):
        return reverse('admin-job-decision', kwargs={'public_id': self.job.public_id})

    def approve_current_revision(self):
        self.client.force_authenticate(self.admin)
        token = self.client.get(self.detail_url()).data['review_token']
        return self.client.post(
            self.decision_url(),
            {'action': 'approve', 'review_token': token},
            format='json',
        )

    def send_back_to_review(self, **changes):
        for field, value in changes.items():
            setattr(self.job, field, value)
        self.job.status = Job.Status.PENDING
        self.job.published_at = None
        self.job.save(update_fields=[*changes, 'status', 'published_at', 'updated_at'])

    def test_approval_captures_the_baseline_shown_to_candidates(self):
        self.assertEqual(self.job.approved_snapshot, {})

        self.approve_current_revision()

        self.job.refresh_from_db()
        self.assertEqual(self.job.approved_snapshot['title'], 'Backend Engineer')
        self.assertIsNotNone(self.job.approved_snapshot_at)

    def test_detail_lists_what_the_employer_changed_since_the_last_approval(self):
        self.approve_current_revision()
        self.send_back_to_review(
            title='Backend Engineer (Senior)',
            description='Nội dung đã được nhà tuyển dụng sửa lại.',
        )

        changes = self.client.get(self.detail_url()).data['pending_changes']

        self.assertTrue(changes['has_baseline'])
        self.assertEqual(changes['changed_count'], 2)
        self.assertEqual(
            {item['key'] for item in changes['changes']},
            {'title', 'description'},
        )
        title_change = next(item for item in changes['changes'] if item['key'] == 'title')
        self.assertEqual(title_change['before'], 'Backend Engineer')
        self.assertEqual(title_change['after'], 'Backend Engineer (Senior)')

    def test_first_submission_reports_no_baseline_instead_of_a_fake_diff(self):
        self.client.force_authenticate(self.admin)

        changes = self.client.get(self.detail_url()).data['pending_changes']

        self.assertFalse(changes['has_baseline'])
        self.assertEqual(changes['changes'], [])

    def test_contact_changes_stay_hidden_from_reviewers_without_the_permission(self):
        contact = JobApplicationContact.objects.create(
            job=self.job,
            recipient_name='Nguyễn Văn A',
            phone='0901234567',
        )
        JobApplicationEmail.objects.create(contact=contact, email='hr@example.com')
        self.approve_current_revision()
        contact.phone = '0987654321'
        contact.save(update_fields=['phone', 'updated_at'])
        self.send_back_to_review(title='Backend Engineer (Senior)')

        privileged = self.client.get(self.detail_url()).data['pending_changes']
        self.client.force_authenticate(self.restricted_admin)
        restricted = self.client.get(self.detail_url()).data['pending_changes']

        self.assertIn('contact_phone', {item['key'] for item in privileged['changes']})
        self.assertNotIn('contact_phone', {item['key'] for item in restricted['changes']})
        self.assertEqual(restricted['hidden_sensitive_count'], 1)
        self.assertEqual(restricted['changed_count'], privileged['changed_count'])

    def test_expired_pending_job_is_approved_together_with_a_new_deadline(self):
        today = timezone.localdate()
        self.job.deadline = today - timedelta(days=1)
        self.job.save(update_fields=['deadline', 'updated_at'])
        self.client.force_authenticate(self.admin)

        detail = self.client.get(self.detail_url())
        without_deadline = self.client.post(
            self.decision_url(),
            {'action': 'approve', 'review_token': detail.data['review_token']},
            format='json',
        )
        with_deadline = self.client.post(
            self.decision_url(),
            {
                'action': 'approve',
                'review_token': self.client.get(self.detail_url()).data['review_token'],
                'deadline': (today + timedelta(days=90)).isoformat(),
            },
            format='json',
        )

        self.assertIn('approve', detail.data['state_actions'])
        self.assertEqual(
            [item['code'] for item in detail.data['approve_requirements']],
            ['deadline'],
        )
        self.assertEqual(detail.data['approve_blockers'], [])
        self.assertEqual(without_deadline.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(with_deadline.status_code, status.HTTP_200_OK, with_deadline.data)
        self.job.refresh_from_db()
        self.assertEqual(self.job.status, Job.Status.ACTIVE)
        self.assertEqual(self.job.deadline, today + timedelta(days=90))

    def test_expired_pending_job_rejects_a_deadline_beyond_ninety_days(self):
        today = timezone.localdate()
        self.job.deadline = today - timedelta(days=1)
        self.job.save(update_fields=['deadline', 'updated_at'])
        self.client.force_authenticate(self.admin)
        detail = self.client.get(self.detail_url())

        response = self.client.post(
            self.decision_url(),
            {
                'action': 'approve',
                'review_token': detail.data['review_token'],
                'deadline': (today + timedelta(days=91)).isoformat(),
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST, response.data)
        self.assertIn('deadline', response.data)
        self.job.refresh_from_db()
        self.assertEqual(self.job.status, Job.Status.PENDING)

    def test_public_visibility_flag_tracks_the_candidate_facing_predicate(self):
        self.client.force_authenticate(self.admin)
        self.job.deadline = timezone.localdate() + timedelta(days=7)
        self.job.save(update_fields=['deadline', 'updated_at'])

        pending = self.client.get(self.detail_url()).data['is_publicly_visible']
        self.approve_current_revision()
        approved = self.client.get(self.detail_url()).data['is_publicly_visible']
        listed = self.client.get(reverse('admin-job-moderation-list')).data['results'][0]
        self.job.refresh_from_db()
        self.job.moderation_hold = Job.ModerationHold.MANUAL_REVIEW
        self.job.save(update_fields=['moderation_hold', 'updated_at'])
        held = self.client.get(self.detail_url()).data['is_publicly_visible']

        self.assertFalse(pending)
        self.assertTrue(approved)
        self.assertTrue(listed['is_publicly_visible'])
        self.assertFalse(held)

    def test_held_job_still_hides_the_approve_action(self):
        self.job.moderation_hold = Job.ModerationHold.MANUAL_REVIEW
        self.job.save(update_fields=['moderation_hold', 'updated_at'])
        self.client.force_authenticate(self.admin)

        detail = self.client.get(self.detail_url())

        self.assertNotIn('approve', detail.data['state_actions'])
        self.assertEqual(
            [item['code'] for item in detail.data['approve_blockers']],
            ['moderation_hold'],
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
        self.recruiter, self.verification_case = make_approvable_recruiter(
            employer=self.employer,
            company=company,
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

    def test_approval_waits_for_verification_transition_and_rechecks_locked_state(self):
        case_locked = Event()
        allow_transition_commit = Event()
        approval_recheck_started = Event()

        def transition_verification():
            close_old_connections()
            try:
                with transaction.atomic():
                    verification_case = EmployerVerificationCase.objects.select_for_update().get(
                        pk=self.verification_case.pk
                    )
                    verification_case.status = EmployerVerificationCase.Status.CHANGES_REQUESTED
                    verification_case.save(update_fields=['status', 'updated_at'])
                    case_locked.set()
                    if not allow_transition_commit.wait(timeout=5):
                        raise AssertionError('Timed out waiting to commit verification transition.')
            finally:
                close_old_connections()

        def approve_after_transition_starts():
            close_old_connections()
            try:
                stale_job = Job.objects.get(pk=self.job.pk)
                try:
                    approve_job(job=stale_job, user=self.admin)
                except ValidationError as error:
                    return error.detail
                return None
            finally:
                close_old_connections()

        def signal_recheck(*args, **kwargs):
            approval_recheck_started.set()
            return recruiter_job_approval_state(*args, **kwargs)

        with patch(
            'apps.jobs.services.moderation.recruiter_job_approval_state',
            side_effect=signal_recheck,
        ):
            with ThreadPoolExecutor(max_workers=2) as pool:
                transition = pool.submit(transition_verification)
                self.assertTrue(case_locked.wait(timeout=5))
                approval = pool.submit(approve_after_transition_starts)
                self.assertTrue(approval_recheck_started.wait(timeout=5))
                allow_transition_commit.set()
                transition.result(timeout=5)
                approval_error = approval.result(timeout=5)

        self.assertIsNotNone(approval_error)
        self.assertEqual(str(approval_error['code']), 'JOB_APPROVAL_BLOCKED')
        self.assertEqual(
            [str(item['code']) for item in approval_error['blocked_reasons']],
            ['verification_required'],
        )
        self.job.refresh_from_db()
        self.assertEqual(self.job.status, Job.Status.PENDING)
        self.assertFalse(self.job.moderation_events.exists())
