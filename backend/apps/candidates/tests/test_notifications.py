from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core import mail
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.accounts.services.tokens import issue_tokens
from apps.sitecontent.models import SiteSetting

from ..models import CandidateEmailNotificationSettings, CandidateNotification, CandidateProfile
from ..services import (
    cancel_candidate_notification,
    deliver_candidate_notification_email,
    emit_candidate_notification,
    pending_candidate_notification_email_ids,
    purge_expired_candidate_notifications,
    release_due_candidate_notifications,
    restore_superseded_candidate_notification,
)
from ..tasks import dispatch_candidate_notifications

Event = CandidateNotification.EventType
Email = CandidateNotification.EmailStatus
CONTEXT = {'company_name': 'Acme', 'job_title': 'Backend Engineer'}


def make_candidate(email='notice-candidate@example.com'):
    return get_user_model().objects.create_user(
        email=email, password='password', role='candidate', email_verified=True
    )


class CandidateNotificationServiceTests(TestCase):
    def setUp(self):
        self.candidate = make_candidate()

    def emit(self, key='k1', event=Event.APPLICATION_SHORTLISTED, **kwargs):
        return emit_candidate_notification(
            recipient=self.candidate, event_type=event, dedupe_key=key, context=CONTEXT, **kwargs
        )

    def test_emit_is_idempotent_and_renders_only_public_context(self):
        first = self.emit(metadata={'application_public_id': 'app_1', 'note': 'secret'})
        second = self.emit()

        self.assertEqual(first.pk, second.pk)
        self.assertIn('Acme', first.message)
        self.assertIn('Backend Engineer', first.message)
        self.assertEqual(first.metadata, {'application_public_id': 'app_1'})

    def test_supersede_cancels_only_undelivered_notices_of_the_group(self):
        delivered = self.emit('a', supersede_key='group')
        release_due_candidate_notifications()
        pending = self.emit(
            'b', supersede_key='group', deliver_after=timezone.now() + timedelta(minutes=5)
        )
        other_group = self.emit(
            'c', supersede_key='other', deliver_after=timezone.now() + timedelta(minutes=5)
        )

        self.emit('d', supersede_key='group', deliver_after=timezone.now() + timedelta(minutes=5))

        delivered.refresh_from_db()
        pending.refresh_from_db()
        other_group.refresh_from_db()
        self.assertIsNone(delivered.cancelled_at)
        self.assertEqual(pending.cancel_reason, CandidateNotification.CancelReason.SUPERSEDED)
        self.assertIsNone(other_group.cancelled_at)

    def test_cancel_loses_to_release_and_restore_reschedules(self):
        later = timezone.now() + timedelta(minutes=5)
        first = self.emit('a', supersede_key='group', deliver_after=later)
        self.emit('b', supersede_key='group', deliver_after=later)

        self.assertTrue(
            cancel_candidate_notification(recipient_id=self.candidate.pk, dedupe_key='b')
        )
        self.assertTrue(
            restore_superseded_candidate_notification(
                recipient_id=self.candidate.pk, dedupe_key='a', deliver_after=later
            )
        )
        first.refresh_from_db()
        self.assertIsNone(first.cancelled_at)

        release_due_candidate_notifications(now=later + timedelta(seconds=1))
        self.assertFalse(
            cancel_candidate_notification(recipient_id=self.candidate.pk, dedupe_key='a')
        )

    def test_release_respects_deliver_after(self):
        notice = self.emit(deliver_after=timezone.now() + timedelta(minutes=5))

        self.assertEqual(release_due_candidate_notifications(), 0)
        self.assertEqual(release_due_candidate_notifications(now=notice.deliver_after), 1)

    def test_decision_email_is_sent_once(self):
        notice = self.emit()
        release_due_candidate_notifications()

        self.assertEqual(deliver_candidate_notification_email(notice.pk), Email.SENT)
        self.assertIsNone(deliver_candidate_notification_email(notice.pk))
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn('Backend Engineer', mail.outbox[0].body)
        self.assertEqual(pending_candidate_notification_email_ids(), [])

    def test_view_email_follows_the_candidate_preference(self):
        profile, _ = CandidateProfile.objects.get_or_create(user=self.candidate)
        CandidateEmailNotificationSettings.objects.create(
            candidate_profile=profile, cv_activity_email=False
        )
        notice = self.emit(event=Event.APPLICATION_VIEWED)
        release_due_candidate_notifications()

        self.assertEqual(deliver_candidate_notification_email(notice.pk), Email.SKIPPED)
        self.assertEqual(mail.outbox, [])

    def test_site_switch_and_restricted_account_skip_email(self):
        SiteSetting.objects.create(key='email_notifications_enabled', value=False)
        notice = self.emit()
        release_due_candidate_notifications()

        self.assertEqual(deliver_candidate_notification_email(notice.pk), Email.SKIPPED)

    def test_transport_failure_is_retried_then_marked_failed(self):
        notice = self.emit()
        release_due_candidate_notifications()
        with patch('apps.candidates.services.notifications.send_html_email', side_effect=OSError):
            results = [deliver_candidate_notification_email(notice.pk) for _ in range(4)]

        self.assertEqual(results, [Email.PENDING, Email.PENDING, Email.PENDING, Email.FAILED])

    def test_dispatcher_releases_and_emails_due_notices(self):
        self.emit()

        result = dispatch_candidate_notifications()

        self.assertEqual(result, {'released': 1, 'emails': 1})
        self.assertEqual(len(mail.outbox), 1)

    def test_purge_respects_retention(self):
        notice = self.emit()
        CandidateNotification.objects.filter(pk=notice.pk).update(
            created_at=timezone.now() - timedelta(days=800)
        )

        self.assertEqual(purge_expired_candidate_notifications(), 1)


class CandidateNotificationApiTests(APITestCase):
    def setUp(self):
        self.candidate = make_candidate()
        self.other = make_candidate('notice-other@example.com')
        self.delivered = emit_candidate_notification(
            recipient=self.candidate,
            event_type=Event.APPLICATION_VIEWED,
            dedupe_key='seen',
            context=CONTEXT,
        )
        emit_candidate_notification(
            recipient=self.candidate,
            event_type=Event.APPLICATION_REJECTED,
            dedupe_key='pending',
            context=CONTEXT,
            deliver_after=timezone.now() + timedelta(minutes=5),
        )
        self.foreign = emit_candidate_notification(
            recipient=self.other,
            event_type=Event.APPLICATION_VIEWED,
            dedupe_key='x',
            context=CONTEXT,
        )
        release_due_candidate_notifications()
        self.login(self.candidate)

    def login(self, user):
        tokens = issue_tokens(user, auth_method='password')
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + tokens['access'])

    def test_inbox_lists_only_delivered_notices_and_counts_unread(self):
        listing = self.client.get(reverse('candidate-notification-list'))
        count = self.client.get(reverse('candidate-notification-unread-count'))

        self.assertEqual(listing.status_code, 200)
        self.assertEqual(
            [item['public_id'] for item in listing.data['results']], [self.delivered.public_id]
        )
        self.assertEqual(count.data, {'count': 1})

    def test_read_one_read_all_and_foreign_notice(self):
        read = self.client.post(
            reverse('candidate-notification-read', args=[self.delivered.public_id])
        )
        foreign = self.client.post(
            reverse('candidate-notification-read', args=[self.foreign.public_id])
        )
        read_all = self.client.post(reverse('candidate-notification-read-all'))

        self.assertTrue(read.data['is_read'])
        self.assertEqual(foreign.status_code, 404)
        self.assertEqual(read_all.data, {'updated': 0})

    def test_employer_cannot_use_candidate_inbox(self):
        employer = get_user_model().objects.create_user(
            email='notice-employer@example.com', password='password', role='employer'
        )
        self.login(employer)

        self.assertEqual(self.client.get(reverse('candidate-notification-list')).status_code, 403)


class CandidateNotificationChannelTests(TestCase):
    """Each switch in "Cài đặt email & thông báo" governs exactly its channel."""

    def setUp(self):
        self.candidate = make_candidate('channel-candidate@example.com')
        self.profile, _ = CandidateProfile.objects.get_or_create(user=self.candidate)

    def settings(self, **values):
        CandidateEmailNotificationSettings.objects.update_or_create(
            candidate_profile=self.profile, defaults=values
        )

    def emit(self, event, key='k'):
        notice = emit_candidate_notification(
            recipient=self.candidate, event_type=event, dedupe_key=key, context=CONTEXT
        )
        release_due_candidate_notifications()
        return notice

    def test_web_switch_hides_the_notice_but_keeps_the_email(self):
        self.settings(cv_activity_web=False)

        notice = self.emit(Event.APPLICATION_VIEWED)

        notice.refresh_from_db()
        self.assertFalse(notice.show_in_inbox)
        self.assertEqual(deliver_candidate_notification_email(notice.pk), Email.SENT)

    def test_decisions_ignore_switches(self):
        self.settings(
            cv_activity_web=False, cv_activity_email=False, application_received_web=False
        )

        notice = self.emit(Event.APPLICATION_REJECTED)

        notice.refresh_from_db()
        self.assertTrue(notice.show_in_inbox)
        self.assertEqual(deliver_candidate_notification_email(notice.pk), Email.SENT)

    def test_unverified_email_is_never_mailed(self):
        self.candidate.email_verified = False
        self.candidate.save(update_fields=['email_verified', 'updated_at'])

        notice = self.emit(Event.APPLICATION_SHORTLISTED)

        self.assertEqual(deliver_candidate_notification_email(notice.pk), Email.SKIPPED)


class ApplicationReceivedEmailTests(TestCase):
    """The rich confirmation email: applied job, similar jobs, branding."""

    def setUp(self):
        from apps.employers.models import Company
        from apps.jobs.models import Job

        self.candidate = make_candidate('received-candidate@example.com')
        employer = get_user_model().objects.create_user(
            email='received-employer@example.com', password='password', role='employer'
        )
        company = Company.objects.create(company_name='Acme', created_by=employer)
        self.job = Job.objects.create(
            posted_by=employer,
            company=company,
            title='Backend Engineer',
            description='d',
            status=Job.Status.ACTIVE,
        )
        self.similar = Job.objects.create(
            posted_by=employer,
            company=company,
            title='Senior Backend Engineer',
            description='d',
            status=Job.Status.ACTIVE,
        )

    def deliver(self):
        notice = emit_candidate_notification(
            recipient=self.candidate,
            event_type=Event.APPLICATION_SUBMITTED,
            dedupe_key='received',
            context=CONTEXT,
            metadata={'job_public_id': self.job.public_id},
        )
        release_due_candidate_notifications()
        self.assertEqual(deliver_candidate_notification_email(notice.pk), Email.SENT)
        return mail.outbox[-1]

    def test_confirmation_lists_similar_jobs_and_links(self):
        with patch(
            'apps.jobs.selectors.similar_jobs_for_job', return_value=[self.similar]
        ) as similar:
            message = self.deliver()

        similar.assert_called_once()
        html = message.alternatives[0][0]
        self.assertIn(
            'Chúc mừng bạn đã ứng tuyển thành công vị trí Backend Engineer', message.subject
        )
        self.assertIn('Senior Backend Engineer', html)
        self.assertIn('Xem tất cả việc làm', html)
        self.assertIn('/tai-khoan/viec-lam-da-ung-tuyen', html)

    def test_similar_jobs_switch_removes_the_block(self):
        profile, _ = CandidateProfile.objects.get_or_create(user=self.candidate)
        CandidateEmailNotificationSettings.objects.create(
            candidate_profile=profile, similar_jobs_in_application_email=False
        )
        with patch('apps.jobs.selectors.similar_jobs_for_job') as similar:
            message = self.deliver()

        similar.assert_not_called()
        self.assertNotIn('Xem tất cả việc làm', message.alternatives[0][0])

    def test_received_email_follows_its_switch(self):
        profile, _ = CandidateProfile.objects.get_or_create(user=self.candidate)
        CandidateEmailNotificationSettings.objects.create(
            candidate_profile=profile, application_received_email=False
        )
        notice = emit_candidate_notification(
            recipient=self.candidate,
            event_type=Event.APPLICATION_SUBMITTED,
            dedupe_key='received-off',
            context=CONTEXT,
        )
        release_due_candidate_notifications()

        self.assertEqual(deliver_candidate_notification_email(notice.pk), Email.SKIPPED)
