from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from apps.candidates.models import CandidateEmailNotificationSettings, CandidateNotification
from apps.candidates.services import (
    cancel_candidate_notification,
    emit_candidate_notification,
    mark_all_candidate_notifications_read,
    release_candidate_notification,
    release_due_candidate_notifications,
)
from apps.employers.models import EmployerNotification
from apps.employers.services import emit_employer_event

from ..domain import user_group

User = get_user_model()
CONTEXT = {'company_name': 'Acme', 'job_title': 'Backend'}


class RecordingLayer:
    """Stands in for the channel layer; the consumer tests cover real delivery."""

    def __init__(self):
        self.sent = []

    async def group_send(self, group, message):
        self.sent.append((group, message))


class GroupListener:
    """What was pushed to one account's group."""

    def __init__(self, layer, user_id):
        self.layer = layer
        self.group = user_group(user_id)

    def events(self):
        return [message['event'] for group, message in self.layer.sent if group == self.group]


class RecordingLayerMixin:
    def setUp(self):
        super().setUp()
        self.layer = RecordingLayer()
        patcher = patch('apps.realtime.services.publish.get_channel_layer', return_value=self.layer)
        patcher.start()
        self.addCleanup(patcher.stop)


class EmployerPushTests(RecordingLayerMixin, TestCase):
    def setUp(self):
        super().setUp()
        self.recruiter = User.objects.create_user(
            email='push-hr@example.com', password='x', role=User.Role.EMPLOYER
        )

    def emit(self, key='k'):
        return emit_employer_event(
            recipient=self.recruiter,
            event_type=EmployerNotification.EventType.APPLICATION_RECEIVED,
            dedupe_key=key,
            metadata={'application_public_id': 'app_1'},
        )

    def test_new_notice_is_pushed_after_commit_and_only_once(self):
        listener = GroupListener(self.layer, self.recruiter.pk)
        with self.captureOnCommitCallbacks(execute=True):
            notification, _ = self.emit()
            self.emit()

        self.assertEqual(
            listener.events(),
            [
                {
                    'type': 'notification.created',
                    'scope': 'employer',
                    'notification': {
                        'public_id': notification.public_id,
                        'event_type': 'application_received',
                        'title': notification.title,
                        'action_path': notification.action_path,
                    },
                }
            ],
        )

    def test_rolled_back_event_is_never_pushed(self):
        listener = GroupListener(self.layer, self.recruiter.pk)
        with self.captureOnCommitCallbacks(execute=False) as callbacks:
            self.emit()
        self.assertEqual(len(callbacks), 1)
        self.assertEqual(listener.events(), [])


class CandidatePushTests(RecordingLayerMixin, TestCase):
    def setUp(self):
        super().setUp()
        self.candidate = User.objects.create_user(
            email='push-candidate@example.com', password='x', role=User.Role.CANDIDATE
        )

    def emit(
        self, key='k', event=CandidateNotification.EventType.APPLICATION_SHORTLISTED, **kwargs
    ):
        return emit_candidate_notification(
            recipient=self.candidate, event_type=event, dedupe_key=key, context=CONTEXT, **kwargs
        )

    def test_notice_is_pushed_when_released_not_when_scheduled(self):
        listener = GroupListener(self.layer, self.candidate.pk)
        with patch('apps.candidates.tasks.release_candidate_notification.apply_async') as timed:
            with self.captureOnCommitCallbacks(execute=True):
                notice = self.emit(deliver_after=timezone.now() + timedelta(seconds=15))
        self.assertEqual(listener.events(), [])
        self.assertAlmostEqual(timed.call_args.kwargs['countdown'], 15, delta=1)

        self.assertFalse(release_candidate_notification(notice.pk))
        with self.captureOnCommitCallbacks(execute=True):
            released = release_candidate_notification(
                notice.pk, now=notice.deliver_after + timedelta(milliseconds=1)
            )

        self.assertTrue(released)
        self.assertEqual(
            [event['notification']['public_id'] for event in listener.events()], [notice.public_id]
        )

    def test_undo_inside_the_window_beats_the_timed_release(self):
        listener = GroupListener(self.layer, self.candidate.pk)
        with patch('apps.candidates.tasks.release_candidate_notification.apply_async'):
            notice = self.emit(deliver_after=timezone.now() + timedelta(seconds=15))
        self.assertTrue(
            cancel_candidate_notification(recipient_id=self.candidate.pk, dedupe_key='k')
        )

        with self.captureOnCommitCallbacks(execute=True):
            released = release_candidate_notification(
                notice.pk, now=timezone.now() + timedelta(minutes=1)
            )

        self.assertFalse(released)
        self.assertEqual(listener.events(), [])

    def test_long_delays_are_left_to_the_beat_dispatcher(self):
        with patch('apps.candidates.tasks.release_candidate_notification.apply_async') as timed:
            with self.captureOnCommitCallbacks(execute=True):
                self.emit(deliver_after=timezone.now() + timedelta(days=3))
        timed.assert_not_called()

    def test_website_switch_off_is_never_pushed(self):
        CandidateEmailNotificationSettings.objects.update_or_create(
            candidate_profile=self.candidate.candidate_profile, defaults={'cv_activity_web': False}
        )
        listener = GroupListener(self.layer, self.candidate.pk)
        with self.captureOnCommitCallbacks(execute=True):
            self.emit(event=CandidateNotification.EventType.APPLICATION_VIEWED)
            release_due_candidate_notifications()

        self.assertEqual(listener.events(), [])

    def test_reading_tells_other_tabs_to_refresh(self):
        with self.captureOnCommitCallbacks(execute=True):
            self.emit()
            release_due_candidate_notifications()
        self.layer.sent.clear()
        listener = GroupListener(self.layer, self.candidate.pk)

        with self.captureOnCommitCallbacks(execute=True):
            mark_all_candidate_notifications_read(self.candidate)

        self.assertEqual(listener.events(), [{'type': 'notification.read', 'scope': 'candidate'}])
