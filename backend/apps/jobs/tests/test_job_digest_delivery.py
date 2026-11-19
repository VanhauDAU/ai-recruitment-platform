"""Send-time gates, SMTP outcomes and receipts of the job digest outbox."""

from datetime import timedelta
from unittest.mock import patch

from django.test import TestCase
from django.utils import timezone

from apps.accounts.models import User
from apps.employers.models import Company
from apps.employers.tests.factories import make_employer_ready

from ..models import (
    CandidateJobDigest,
    CandidateJobDigestItem,
    CandidateJobEmailReceipt,
    CandidateJobEmailSuppression,
    Job,
)
from ..services import (
    create_job_alert,
    deliver_candidate_job_digest,
    update_job_alert,
)
from ..services.digests import (
    purge_candidate_job_digest_history,
)
from .factories import enable_email_notifications, open_visibility_window


class CandidateJobDigestDeliveryTests(TestCase):
    def setUp(self):
        self.now = timezone.now()
        self.candidate = User.objects.create_user(
            email='digest-candidate@example.com',
            password='Password@123',
            role=User.Role.CANDIDATE,
            email_verified=True,
            full_name='Ứng viên Digest',
        )
        self.employer = User.objects.create_user(
            email='digest-employer@example.com',
            password='Password@123',
            role=User.Role.EMPLOYER,
        )
        self.company = Company.objects.create(
            company_name='Digest Company',
            created_by=self.employer,
        )
        make_employer_ready(self.employer, company=self.company, candidate_data=True)
        enable_email_notifications()
        self.alert = create_job_alert(self.candidate, {'keyword': 'Python'})
        self.alert.cursor_at = self.now - timedelta(days=1)
        self.alert.save(update_fields=['cursor_at', 'updated_at'])

    def _job(self, title='Python Engineer'):
        return Job.objects.create(
            posted_by=self.employer,
            company=self.company,
            title=title,
            description='Mô tả.',
            status=Job.Status.ACTIVE,
            published_at=self.now - timedelta(minutes=5),
            **open_visibility_window(),
        )

    def _digest(self, job, *, scheduled_for=None):
        scheduled_for = scheduled_for or self.now
        digest = CandidateJobDigest.objects.create(
            candidate=self.candidate,
            scheduled_for=scheduled_for,
            source_alert_public_ids=[self.alert.public_id],
            source_windows={
                'alerts': {self.alert.public_id: (scheduled_for - timedelta(hours=1)).isoformat()},
                'suitable': None,
            },
            recipient_email=self.candidate.email,
            recipient_auth_revision=self.candidate.auth_revision,
            status=CandidateJobDigest.Status.PENDING,
            job_count=1,
        )
        CandidateJobDigestItem.objects.create(
            digest=digest,
            candidate=self.candidate,
            job=job,
            source_kind=CandidateJobDigestItem.SourceKind.CONFIGURED_ALERT,
            source_alert=self.alert,
            source_alert_public_ids=[self.alert.public_id],
            source_alert_fingerprints={
                self.alert.public_id: self.alert.criteria_fingerprint,
            },
            job_published_at=job.published_at,
        )
        return digest

    @patch('apps.jobs.services.digests.delivery.send_html_email')
    def test_email_is_vietnamese_by_default(self, send):
        deliver_candidate_job_digest(self._digest(self._job()).pk)

        email = send.call_args.kwargs
        self.assertEqual(email['subject'], '1 việc làm mới dành cho bạn · ProCV')
        self.assertIn('Xin chào Ứng viên Digest,', email['text'])
        self.assertIn('Mức lương: Thỏa thuận', email['text'])
        self.assertIn('<html lang="vi">', email['html'])

    @patch('apps.jobs.services.digests.delivery.send_html_email')
    def test_email_follows_the_candidate_language_not_the_worker_language(self, send):
        self.candidate.preferred_language = 'en'
        self.candidate.save(update_fields=['preferred_language', 'updated_at'])

        deliver_candidate_job_digest(self._digest(self._job()).pk)

        email = send.call_args.kwargs
        self.assertEqual(email['subject'], '1 new job for you · ProCV')
        self.assertIn('Hello Ứng viên Digest,', email['text'])
        self.assertIn('ProCV has 1 new job for you:', email['text'])
        self.assertIn('Salary: Negotiable', email['text'])
        self.assertIn('This is an automated email from ProCV.', email['text'])
        self.assertIn('<html lang="en">', email['html'])
        self.assertIn('There is 1 new job matching the alerts you turned on.', email['html'])
        self.assertIn('Manage job alerts', email['html'])
        self.assertNotIn('Xin chào', email['html'])

    @patch('apps.jobs.services.digests.delivery.send_html_email')
    def test_success_persists_receipt_message_id_and_delayed_digest_is_deduped(self, send):
        job = self._job()
        first = self._digest(job)

        result = deliver_candidate_job_digest(first.pk)

        self.assertEqual(result, CandidateJobDigest.Status.SENT)
        send.assert_called_once()
        self.assertEqual(send.call_args.kwargs['headers'], {'Message-ID': first.message_id})
        self.assertTrue(
            CandidateJobEmailReceipt.objects.filter(
                candidate=self.candidate,
                job=job,
                job_published_at=job.published_at,
            ).exists()
        )
        self.assertTrue(
            CandidateJobEmailSuppression.objects.filter(
                candidate=self.candidate,
                job=job,
            ).exists()
        )

        job.published_at = self.now + timedelta(seconds=30)
        job.save(update_fields=['published_at', 'updated_at'])
        delayed = self._digest(job, scheduled_for=self.now + timedelta(minutes=1))
        second_result = deliver_candidate_job_digest(delayed.pk)
        self.assertEqual(second_result, CandidateJobDigest.Status.CANCELLED)
        self.assertEqual(send.call_count, 1)

        purge_candidate_job_digest_history(self.now + timedelta(days=91))
        self.assertFalse(
            CandidateJobEmailReceipt.objects.filter(candidate=self.candidate, job=job).exists()
        )
        self.assertTrue(
            CandidateJobEmailSuppression.objects.filter(
                candidate=self.candidate,
                job=job,
            ).exists()
        )
        after_retention = self._digest(
            job,
            scheduled_for=self.now + timedelta(days=92),
        )
        third_result = deliver_candidate_job_digest(after_retention.pk)
        self.assertEqual(third_result, CandidateJobDigest.Status.CANCELLED)
        self.assertEqual(send.call_count, 1)

    @patch(
        'apps.jobs.services.digests.delivery.send_html_email', side_effect=RuntimeError('SMTP down')
    )
    def test_failure_retries_four_service_attempts_without_advancing_cursor(self, _send):
        job = self._job('Python Retry')
        previous_cursor = self.now - timedelta(hours=2)
        self.alert.cursor_at = previous_cursor
        self.alert.save(update_fields=['cursor_at', 'updated_at'])
        digest = self._digest(job)
        digest.source_windows = {
            'alerts': {self.alert.public_id: previous_cursor.isoformat()},
            'suitable': None,
        }
        digest.save(update_fields=['source_windows', 'updated_at'])

        for expected_attempt in range(1, 5):
            with self.assertRaisesRegex(RuntimeError, 'SMTP down'):
                deliver_candidate_job_digest(digest.pk)
            digest.refresh_from_db()
            self.assertEqual(digest.attempts, expected_attempt)
            expected_status = (
                CandidateJobDigest.Status.FAILED
                if expected_attempt == 4
                else CandidateJobDigest.Status.PENDING
            )
            self.assertEqual(digest.status, expected_status)

        self.assertFalse(CandidateJobEmailReceipt.objects.filter(candidate=self.candidate))
        self.assertFalse(CandidateJobEmailSuppression.objects.filter(candidate=self.candidate))
        self.alert.refresh_from_db()
        self.assertEqual(self.alert.cursor_at, previous_cursor)

    @patch('apps.jobs.services.digests.delivery.send_html_email')
    def test_current_job_must_still_match_alert_immediately_before_send(self, send):
        job = self._job('Python Current Match')
        digest = self._digest(job)
        job.title = 'Java Current Match'
        job.save(update_fields=['title', 'updated_at'])

        result = deliver_candidate_job_digest(digest.pk)

        self.assertEqual(result, CandidateJobDigest.Status.CANCELLED)
        send.assert_not_called()
        self.assertFalse(CandidateJobEmailSuppression.objects.filter(candidate=self.candidate))

    @patch('apps.jobs.services.digests.delivery.send_html_email')
    def test_alert_edit_invalidates_items_prepared_with_old_fingerprint(self, send):
        digest = self._digest(self._job('Python Snapshot'))
        update_job_alert(self.candidate, self.alert, {'keyword': 'Java'})

        result = deliver_candidate_job_digest(digest.pk)

        self.assertEqual(result, CandidateJobDigest.Status.CANCELLED)
        send.assert_not_called()

    @patch('apps.jobs.services.digests.delivery.send_html_email')
    def test_current_recipient_identity_is_rechecked_before_send(self, send):
        digest = self._digest(self._job('Python Identity'))
        self.candidate.email = 'changed-email@example.com'
        self.candidate.auth_revision += 1
        self.candidate.save(update_fields=['email', 'auth_revision', 'updated_at'])

        result = deliver_candidate_job_digest(digest.pk)

        self.assertEqual(result, CandidateJobDigest.Status.CANCELLED)
        send.assert_not_called()
        self.assertFalse(CandidateJobEmailReceipt.objects.filter(candidate=self.candidate))
