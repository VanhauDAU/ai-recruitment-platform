from datetime import timedelta

from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.test import APITestCase

from apps.accounts.tests.helpers import make_admin
from apps.employers.models import Company, EmployerNotification, EmployerVerificationCase
from apps.employers.tests.readiness_helpers import make_employer_ready
from common.vietnam_time import vietnam_today

from ..api.serializers import EmployerJobWriteSerializer
from ..models import (
    Job,
    JobApplicationContact,
    JobApplicationEmail,
    JobModerationEvent,
)
from ..services import build_job_content_snapshot, update_employer_job
from .helpers import open_visibility_window


class JobModerationFixture:
    """One public job plus an employer and a regular admin reviewer."""

    def setUp(self):
        user_model = get_user_model()
        self.employer = user_model.objects.create_user(
            email='job-owner@example.com', password='Password@123', role=user_model.Role.EMPLOYER
        )
        self.admin = make_admin('job-admin@example.com')
        company = Company.objects.create(company_name='Moderation Co', created_by=self.employer)
        self.company = company
        self.recruiter = make_employer_ready(self.employer, company=company, candidate_data=True)
        self.verification_case = self.recruiter.verification_case
        now = timezone.now()
        self.job = Job.objects.create(
            posted_by=self.employer,
            company=company,
            title='Backend Engineer',
            description='Xây dựng nền tảng tuyển dụng.',
            status=Job.Status.ACTIVE,
            deadline=vietnam_today() + timedelta(days=7),
            submitted_at=now,
            published_at=now,
            approved_at=now,
            **open_visibility_window(),
        )

    def detail_url(self):
        return reverse(
            'admin-job-moderation-detail',
            kwargs={'public_id': self.job.public_id},
        )

    def decision_url(self):
        return reverse('admin-job-decision', kwargs={'public_id': self.job.public_id})


class JobChangesRequestedTests(JobModerationFixture, APITestCase):
    """Fixable content: request changes, owner edits and resubmits, admin restores."""

    NOTE = 'Bổ sung mức lương và địa chỉ làm việc cụ thể.'

    def decide(self, action, **payload):
        self.client.force_authenticate(self.admin)
        token = self.client.get(self.detail_url()).data['review_token']
        return self.client.post(
            self.decision_url(),
            {'action': action, 'review_token': token, 'note': self.NOTE, **payload},
            format='json',
        )

    def edit_title(self, title):
        serializer = EmployerJobWriteSerializer(self.job, data={'title': title}, partial=True)
        serializer.is_valid(raise_exception=True)
        return update_employer_job(self.job, self.employer, serializer.validated_data)

    def employer_hold(self):
        self.client.force_authenticate(self.employer)
        detail = self.client.get(
            reverse('employer-job-detail', kwargs={'public_id': self.job.public_id})
        )
        return detail.data['visibility_hold']

    def test_severe_reasons_cannot_be_turned_into_a_change_request(self):
        response = self.decide('request_changes', reason_code='fraud_risk')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST, response.data)
        self.job.refresh_from_db()
        self.assertEqual(self.job.moderation_hold, Job.ModerationHold.NONE)

    def test_owner_is_told_what_to_fix_and_may_edit_the_hidden_job(self):
        response = self.decide('request_changes', reason_code='incomplete_content')

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.job.refresh_from_db()
        self.assertEqual(self.job.moderation_hold, Job.ModerationHold.CHANGES_REQUESTED)
        self.assertFalse(Job.publicly_available_queryset().filter(pk=self.job.pk).exists())
        self.assertTrue(
            EmployerNotification.objects.filter(
                recipient=self.employer,
                event_type=EmployerNotification.EventType.JOB_CHANGES_REQUESTED,
            ).exists()
        )
        hold = self.employer_hold()
        self.assertTrue(hold['editable'])
        self.assertEqual(hold['request_note'], self.NOTE)
        self.assertEqual(self.edit_title('Backend Engineer (Go)').title, 'Backend Engineer (Go)')

    def test_resubmitted_job_waits_for_review_and_is_locked_meanwhile(self):
        self.decide('request_changes', reason_code='misleading_content')
        self.client.force_authenticate(self.employer)
        resubmit_url = reverse('employer-job-resubmit', kwargs={'public_id': self.job.public_id})
        self.job.refresh_from_db()
        self.edit_title('Backend Engineer (Go)')

        resubmitted = self.client.post(resubmit_url)
        twice = self.client.post(resubmit_url)

        self.assertEqual(resubmitted.status_code, status.HTTP_200_OK, resubmitted.data)
        self.assertEqual(twice.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(resubmitted.data['visibility_hold']['editable'])
        self.job.refresh_from_db()
        with self.assertRaises(ValidationError):
            self.edit_title('Đổi sau khi gửi')
        self.assertFalse(Job.publicly_available_queryset().filter(pk=self.job.pk).exists())

        self.client.force_authenticate(self.admin)
        queue = self.client.get(reverse('admin-job-moderation-list'), {'scope': 'resubmitted'})
        summary = self.client.get(reverse('admin-job-moderation-summary'))
        self.assertEqual(
            [item['public_id'] for item in queue.data['results']], [self.job.public_id]
        )
        self.assertEqual(summary.data['resubmitted'], 1)

        restored = self.decide('restore')

        self.assertEqual(restored.status_code, status.HTTP_200_OK, restored.data)
        self.job.refresh_from_db()
        self.assertIsNone(self.job.moderation_resubmitted_at)
        self.assertTrue(Job.publicly_available_queryset().filter(pk=self.job.pk).exists())

    def test_resubmitting_without_any_edit_is_refused(self):
        self.decide('request_changes', reason_code='incomplete_content')
        self.client.force_authenticate(self.employer)
        resubmit_url = reverse('employer-job-resubmit', kwargs={'public_id': self.job.public_id})

        unchanged = self.client.post(resubmit_url)

        self.assertEqual(unchanged.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('chưa sửa', str(unchanged.data))
        self.job.refresh_from_db()
        self.assertIsNone(self.job.moderation_resubmitted_at)

        self.edit_title('Backend Engineer (Go)')
        self.assertEqual(self.client.post(resubmit_url).status_code, status.HTTP_200_OK)

    def test_restoring_gives_back_the_display_time_spent_hidden(self):
        self.job.refresh_from_db()
        ends_at = self.job.visibility_ends_at
        deadline = self.job.deadline
        self.decide('hide', reason_code='fraud_risk', hold=Job.ModerationHold.MANUAL_REVIEW)
        Job.objects.filter(pk=self.job.pk).update(
            moderation_held_at=timezone.now() - timedelta(days=4)
        )
        # Escalating to a change request keeps the moment the job left the list.
        self.decide('request_changes', reason_code='incomplete_content')

        self.decide('restore')

        self.job.refresh_from_db()
        self.assertAlmostEqual(
            (self.job.visibility_ends_at - ends_at).total_seconds(),
            timedelta(days=4).total_seconds(),
            delta=60,
        )
        self.assertEqual(self.job.deadline, deadline)
        self.assertEqual(self.job.moderation_content_digest, '')

    def test_a_job_hidden_for_review_stays_locked_for_its_owner(self):
        self.decide('hide', reason_code='fraud_risk', hold=Job.ModerationHold.MANUAL_REVIEW)
        self.job.refresh_from_db()

        self.assertFalse(self.employer_hold()['editable'])
        with self.assertRaises(ValidationError):
            self.edit_title('Không được sửa')


class JobModerationApiTests(JobModerationFixture, APITestCase):
    def test_non_admin_cannot_review_jobs(self):
        self.client.force_authenticate(self.employer)

        response = self.client.get(reverse('admin-job-moderation-list'))

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_management_list_summary_and_detail_return_operational_read_models(self):
        self.client.force_authenticate(self.admin)

        listing = self.client.get(
            reverse('admin-job-moderation-list'),
            {'q': 'Backend', 'status': 'active', 'ordering': 'title'},
        )
        summary = self.client.get(reverse('admin-job-moderation-summary'))
        detail = self.client.get(self.detail_url())

        self.assertEqual(listing.status_code, status.HTTP_200_OK, listing.data)
        self.assertEqual(listing.data['count'], 1)
        self.assertEqual(listing.data['results'][0]['public_id'], self.job.public_id)
        self.assertEqual(listing.data['results'][0]['pending_report_count'], 0)
        self.assertEqual(listing.data['results'][0]['published_job_count'], 1)
        self.assertEqual(summary.status_code, status.HTTP_200_OK, summary.data)
        self.assertEqual(summary.data['total'], 1)
        self.assertEqual(summary.data['active'], 1)
        self.assertEqual(summary.data['draft'], 0)
        self.assertNotIn('pending', summary.data)
        self.assertNotIn('rejected', summary.data)
        self.assertEqual(detail.status_code, status.HTTP_200_OK, detail.data)
        self.assertEqual(detail.data['public_id'], self.job.public_id)
        self.assertEqual(detail.data['state_actions'], ['hide', 'request_changes'])
        self.assertTrue(detail.data['review_token'])
        self.assertIn('moderation_events', detail.data)

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
            status=Job.Status.DRAFT,
        )
        second_newest = Job.objects.create(
            posted_by=self.employer,
            company=self.company,
            title='Newest B',
            status=Job.Status.DRAFT,
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

    def test_detail_explains_employer_blockers_without_duplicates(self):
        self.recruiter.dpa_accepted_at = None
        self.recruiter.save(update_fields=['dpa_accepted_at', 'updated_at'])
        self.verification_case.status = EmployerVerificationCase.Status.IN_REVIEW
        self.verification_case.save(update_fields=['status', 'updated_at'])
        self.client.force_authenticate(self.admin)

        detail = self.client.get(self.detail_url())

        blocker_codes = [item['code'] for item in detail.data['blocked_reasons']]
        self.assertEqual(blocker_codes, ['verification_required', 'dpa_required'])
        self.assertEqual(len(blocker_codes), len(set(blocker_codes)))
        self.assertNotIn('approve_blockers', detail.data)

    def test_decision_endpoint_no_longer_accepts_approval_or_rejection(self):
        self.client.force_authenticate(self.admin)
        token = self.client.get(self.detail_url()).data['review_token']

        for action in ('approve', 'reject'):
            with self.subTest(action=action):
                response = self.client.post(
                    self.decision_url(),
                    {
                        'action': action,
                        'review_token': token,
                        'reason_code': 'other',
                        'note': 'Quyết định duyệt trước không còn tồn tại.',
                    },
                    format='json',
                )
                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST, response.data)
                self.assertIn('action', response.data)

        self.job.refresh_from_db()
        self.assertEqual(self.job.status, Job.Status.ACTIVE)
        self.assertFalse(self.job.moderation_events.exists())

    def test_decision_endpoint_rejects_a_stale_preview(self):
        self.client.force_authenticate(self.admin)
        token = self.client.get(self.detail_url()).data['review_token']
        self.job.title = 'Backend Engineer — revised'
        self.job.save(update_fields=['title', 'updated_at'])

        response = self.client.post(
            self.decision_url(),
            {
                'action': 'hide',
                'review_token': token,
                'reason_code': 'misleading_content',
                'note': 'Nội dung đã đổi sau khi mở bản xem trước.',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT, response.data)
        self.job.refresh_from_db()
        self.assertEqual(self.job.moderation_hold, Job.ModerationHold.NONE)
        self.assertFalse(self.job.moderation_events.exists())

    def test_admin_can_hide_and_restore_an_active_job_without_changing_business_status(self):
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
        self.assertEqual(hidden.data['state_actions'], ['request_changes', 'restore'])
        hidden_public_list = self.client.get(reverse('job-list'))
        hidden_public_detail = self.client.get(
            reverse('job-detail', kwargs={'slug': self.job.slug})
        )
        self.assertEqual(visible_before.data['count'], 1)
        self.assertEqual(hidden_public_list.data['count'], 0)
        self.assertEqual(hidden_public_detail.status_code, status.HTTP_404_NOT_FOUND)

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


class JobPublishedContentChangesTests(JobModerationFixture, APITestCase):
    """Edits made after publication must be comparable with the published baseline."""

    def capture_published_baseline(self):
        self.job.approved_snapshot = build_job_content_snapshot(self.job)
        self.job.approved_snapshot_at = timezone.now()
        self.job.save(update_fields=['approved_snapshot', 'approved_snapshot_at', 'updated_at'])

    def edit_job(self, **changes):
        for field, value in changes.items():
            setattr(self.job, field, value)
        self.job.save(update_fields=[*changes, 'updated_at'])

    def test_detail_lists_what_the_employer_changed_since_publication(self):
        self.capture_published_baseline()
        self.edit_job(
            title='Backend Engineer (Senior)',
            description='Nội dung đã được nhà tuyển dụng sửa lại.',
        )
        self.client.force_authenticate(self.admin)

        changes = self.client.get(self.detail_url()).data['content_changes']

        self.assertTrue(changes['has_baseline'])
        self.assertEqual(changes['changed_count'], 2)
        self.assertEqual(
            {item['key'] for item in changes['changes']},
            {'title', 'description'},
        )
        title_change = next(item for item in changes['changes'] if item['key'] == 'title')
        self.assertEqual(title_change['before'], 'Backend Engineer')
        self.assertEqual(title_change['after'], 'Backend Engineer (Senior)')

    def test_job_without_a_snapshot_reports_no_baseline_instead_of_a_fake_diff(self):
        self.client.force_authenticate(self.admin)

        changes = self.client.get(self.detail_url()).data['content_changes']

        self.assertFalse(changes['has_baseline'])
        self.assertEqual(changes['changes'], [])

    def test_contact_changes_are_visible_to_every_admin(self):
        contact = JobApplicationContact.objects.create(
            job=self.job,
            recipient_name='Nguyễn Văn A',
            phone='0901234567',
        )
        JobApplicationEmail.objects.create(contact=contact, email='hr@example.com')
        self.job.refresh_from_db()
        self.capture_published_baseline()
        contact.phone = '0987654321'
        contact.save(update_fields=['phone', 'updated_at'])
        self.edit_job(title='Backend Engineer (Senior)')

        self.client.force_authenticate(self.admin)
        changes = self.client.get(self.detail_url()).data['content_changes']

        self.assertIn('contact_phone', {item['key'] for item in changes['changes']})
        self.assertEqual(changes['hidden_sensitive_count'], 0)

    def test_public_visibility_flag_tracks_the_candidate_facing_predicate(self):
        draft = Job.objects.create(
            posted_by=self.employer,
            company=self.company,
            title='Unpublished draft',
            status=Job.Status.DRAFT,
        )
        self.client.force_authenticate(self.admin)

        published = self.client.get(self.detail_url()).data['is_publicly_visible']
        listed = {
            item['public_id']: item['is_publicly_visible']
            for item in self.client.get(reverse('admin-job-moderation-list')).data['results']
        }
        self.job.moderation_hold = Job.ModerationHold.MANUAL_REVIEW
        self.job.save(update_fields=['moderation_hold', 'updated_at'])
        held = self.client.get(self.detail_url()).data['is_publicly_visible']

        self.assertTrue(published)
        self.assertTrue(listed[self.job.public_id])
        self.assertFalse(listed[draft.public_id])
        self.assertFalse(held)


class EmployerVisibilityHoldTests(JobModerationFixture, APITestCase):
    """The owner must learn that a job is hidden, and why, without admin-only detail."""

    internal_note = 'Người báo cáo cung cấp ảnh chụp yêu cầu đặt cọc.'

    def owner_views(self):
        self.client.force_authenticate(self.employer)
        listed = self.client.get(reverse('employer-job-list-create')).data['results']
        detail = self.client.get(
            reverse('employer-job-detail', kwargs={'public_id': self.job.public_id})
        )
        return listed[0], detail

    def hide_job(self):
        self.client.force_authenticate(self.admin)
        token = self.client.get(self.detail_url()).data['review_token']
        hidden = self.client.post(
            self.decision_url(),
            {
                'action': 'hide',
                'review_token': token,
                'reason_code': 'fraud_risk',
                'hold': Job.ModerationHold.MANUAL_REVIEW,
                'note': self.internal_note,
            },
            format='json',
        )
        self.assertEqual(hidden.status_code, status.HTTP_200_OK, hidden.data)
        return hidden.data['review_token']

    def test_visible_job_reports_no_hold(self):
        listed, detail = self.owner_views()

        self.assertIsNone(listed['visibility_hold'])
        self.assertIsNone(detail.data['visibility_hold'])

    def test_owner_sees_the_hold_and_its_reason_category_but_not_the_internal_note(self):
        review_token = self.hide_job()

        listed, detail = self.owner_views()

        for hold in (listed['visibility_hold'], detail.data['visibility_hold']):
            self.assertEqual(hold['kind'], 'moderation')
            self.assertEqual(hold['code'], Job.ModerationHold.MANUAL_REVIEW)
            self.assertEqual(hold['label'], 'Tạm ẩn để rà soát nội dung')
            self.assertEqual(hold['reason_code'], 'fraud_risk')
            self.assertEqual(hold['reason_label'], 'Có dấu hiệu lừa đảo')
            self.assertIsNotNone(hold['held_at'])
        self.assertEqual(detail.data['status'], Job.Status.ACTIVE)
        self.assertNotIn(self.internal_note, detail.content.decode())

        self.client.force_authenticate(self.admin)
        restored = self.client.post(
            self.decision_url(),
            {
                'action': 'restore',
                'review_token': review_token,
                'note': 'Đã xác minh nội dung hợp lệ.',
            },
            format='json',
        )
        self.assertEqual(restored.status_code, status.HTTP_200_OK, restored.data)
        listed, detail = self.owner_views()
        self.assertIsNone(listed['visibility_hold'])
        self.assertIsNone(detail.data['visibility_hold'])

    def test_reason_comes_from_the_latest_hide_when_a_job_is_hidden_again(self):
        review_token = self.hide_job()
        self.client.force_authenticate(self.admin)
        restored = self.client.post(
            self.decision_url(),
            {'action': 'restore', 'review_token': review_token, 'note': 'Khôi phục.'},
            format='json',
        )
        hidden_again = self.client.post(
            self.decision_url(),
            {
                'action': 'hide',
                'review_token': restored.data['review_token'],
                'reason_code': 'duplicate_posting',
                'hold': Job.ModerationHold.MANUAL_REVIEW,
                'note': 'Trùng với tin đã đăng trước đó.',
            },
            format='json',
        )
        self.assertEqual(hidden_again.status_code, status.HTTP_200_OK, hidden_again.data)

        listed, detail = self.owner_views()

        self.assertEqual(listed['visibility_hold']['reason_code'], 'duplicate_posting')
        self.assertEqual(detail.data['visibility_hold']['reason_label'], 'Tin trùng lặp')

    def test_owner_sees_an_account_level_hold(self):
        held_at = timezone.now()
        Job.objects.filter(pk=self.job.pk).update(
            policy_hold=Job.PolicyHold.BAN_REVIEW,
            policy_held_at=held_at,
        )

        listed, detail = self.owner_views()

        for hold in (listed['visibility_hold'], detail.data['visibility_hold']):
            self.assertEqual(hold['kind'], 'account')
            self.assertEqual(hold['code'], Job.PolicyHold.BAN_REVIEW)
            self.assertEqual(hold['label'], 'Giữ để rà soát sau cấm')
            self.assertEqual(hold['reason_code'], '')

    def test_action_response_explains_the_hold_without_the_list_annotation(self):
        self.hide_job()
        self.client.force_authenticate(self.employer)

        closed = self.client.post(
            reverse('employer-job-close', kwargs={'public_id': self.job.public_id})
        )

        self.assertEqual(closed.status_code, status.HTTP_200_OK, closed.data)
        self.assertEqual(closed.data['status'], Job.Status.CLOSED)
        self.assertEqual(closed.data['visibility_hold']['reason_code'], 'fraud_risk')
