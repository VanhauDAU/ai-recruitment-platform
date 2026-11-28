import uuid
from datetime import timedelta
from unittest.mock import patch

from django.core import mail
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.candidates.models import CandidateNotification
from apps.employers.models import EmployerNotification, EmployerVerificationCase
from apps.employers.tests.factories import PDF_BYTES
from apps.jobs.tests.factories import enable_email_notifications

from ..models import Conversation, InterviewAppointment, Message
from ..services import (
    erase_user_messages,
    send_interview_calendar,
    send_interview_reminders,
    send_unread_message_emails,
    typing_target,
)
from .factories import ConnectFixture


class ConversationMixin(ConnectFixture):
    def setUp(self):
        super().setUp()
        self.login(self.recruiter)
        response = self.client.post(
            reverse('employer-conversation-list'),
            {'application': self.application.public_id},
            format='json',
        )
        self.conversation_id = response.data['public_id']

    def upload(self, user, portal, name, content, content_type):
        self.login(user)
        return self.client.post(
            reverse(f'{portal}-conversation-messages', args=[self.conversation_id]),
            {
                'client_id': str(uuid.uuid4()),
                'file': SimpleUploadedFile(name, content, content_type=content_type),
            },
            format='multipart',
        )


class AttachmentTests(ConversationMixin, APITestCase):
    def test_pdf_is_stored_privately_and_streamed_to_members_only(self):
        response = self.upload(
            self.candidate, 'candidate', 'cv cua toi.pdf', PDF_BYTES, 'application/pdf'
        )

        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data['kind'], 'file')
        self.assertEqual(response.data['file']['name'], 'cv cua toi.pdf')
        message_id = response.data['public_id']
        self.login(self.recruiter)
        stream = self.client.get(
            reverse('employer-conversation-message-file', args=[self.conversation_id, message_id])
        )
        self.login(self.outsider)
        outsider = self.client.get(
            reverse('employer-conversation-message-file', args=[self.conversation_id, message_id])
        )

        self.assertEqual(stream.status_code, 200)
        self.assertEqual(stream['Cache-Control'], 'private, no-store')
        self.assertEqual(b''.join(stream.streaming_content), PDF_BYTES)
        self.assertEqual(outsider.status_code, 404)

    def test_a_disguised_file_is_refused(self):
        response = self.upload(
            self.candidate, 'candidate', 'virus.pdf', b'MZ\x90\x00 not a pdf', 'application/pdf'
        )

        self.assertEqual(response.status_code, 400)
        self.assertFalse(Message.objects.filter(kind__in=['file', 'image']).exists())


class InterviewTests(ConversationMixin, APITestCase):
    def propose(self, **overrides):
        self.login(self.recruiter)
        payload = {
            'starts_at': (timezone.now() + timedelta(days=2)).isoformat(),
            'duration_minutes': 45,
            'mode': 'online',
            'meeting_url': 'https://meet.example.com/abc',
            'note': 'Mang theo laptop',
            **overrides,
        }
        return self.client.post(
            reverse('employer-conversation-interviews', args=[self.conversation_id]),
            payload,
            format='json',
        )

    def respond(self, interview_id, action, note=''):
        self.login(self.candidate)
        return self.client.post(
            reverse('candidate-interview-respond', args=[interview_id]),
            {'action': action, 'note': note},
            format='json',
        )

    def test_recruiter_proposes_and_candidate_is_notified(self):
        response = self.propose()

        self.assertEqual(response.status_code, 201, response.data)
        card = response.data['interview']
        self.assertEqual((card['status'], card['duration_minutes']), ('proposed', 45))
        self.assertTrue(card['actions']['cancel'])
        # Gửi lịch là mời phỏng vấn: hồ sơ "Mới" chuyển "Phỏng vấn", ứng viên nhận
        # đúng một thông báo (mời phỏng vấn, báo ngay, trỏ vào hội thoại).
        self.application.refresh_from_db()
        self.assertEqual(self.application.status, 'interviewed')
        notices = list(
            CandidateNotification.objects.filter(recipient=self.candidate).exclude(
                event_type='application_submitted'
            )
        )
        self.assertEqual([item.event_type for item in notices], ['application_interviewed'])
        self.assertIn(self.conversation_id, notices[0].action_path)
        self.assertLessEqual(notices[0].deliver_after, timezone.now())
        pushed = [
            event['message']['interview']
            for event in self.events(self.candidate)
            if event['type'] == 'chat.message.created' and event['message']['kind'] == 'interview'
        ][-1]
        self.assertTrue(pushed['actions']['respond'])

    def test_online_interview_needs_a_link_and_a_future_time(self):
        self.assertEqual(self.propose(meeting_url='').status_code, 400)
        past = (timezone.now() - timedelta(hours=1)).isoformat()
        self.assertEqual(self.propose(starts_at=past).status_code, 400)

    def test_a_new_proposal_supersedes_the_open_one(self):
        first = self.propose().data['interview']['public_id']
        self.propose()

        self.assertEqual(InterviewAppointment.objects.get(public_id=first).status, 'superseded')
        self.assertEqual(InterviewAppointment.objects.filter(status='proposed').count(), 1)

    def test_candidate_accepts_and_both_get_a_calendar_email(self):
        enable_email_notifications()
        interview_id = self.propose().data['interview']['public_id']

        response = self.respond(interview_id, 'accept')

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['interview']['status'], 'accepted')
        self.assertTrue(
            EmployerNotification.objects.filter(
                recipient=self.recruiter, event_type='interview_responded'
            ).exists()
        )
        system = Message.objects.filter(kind='system').last()
        self.assertEqual(system.payload['event'], 'interview_accepted')
        mail.outbox.clear()
        EmployerVerificationCase.objects.filter(recruiter__user=self.recruiter).update(
            verification_method=EmployerVerificationCase.VerificationMethod.BUSINESS_REGISTRATION
        )
        sent = send_interview_calendar(InterviewAppointment.objects.get(public_id=interview_id))
        self.assertEqual(sent, 2)
        # Ứng viên nhận dưới tên công ty, nhà tuyển dụng nhận từ ProCV.
        senders = {message.to[0]: message.from_email for message in mail.outbox}
        self.assertTrue(senders[self.candidate.email].startswith('Connect Co qua ProCV <'))
        self.assertTrue(senders[self.recruiter.email].startswith('ProCV <'))
        attachment = mail.outbox[0].attachments[0]
        self.assertEqual(attachment[0], 'phong-van.ics')
        self.assertIn('BEGIN:VEVENT', attachment[1])
        self.assertEqual(self.respond(interview_id, 'decline').status_code, 400)

    def test_reschedule_request_then_recruiter_cancels(self):
        interview_id = self.propose().data['interview']['public_id']
        self.respond(interview_id, 'reschedule', 'Chiều thứ 6 được không ạ?')
        self.login(self.recruiter)

        cancelled = self.client.post(
            reverse('employer-interview-cancel', args=[interview_id]), {}, format='json'
        )

        interview = InterviewAppointment.objects.get(public_id=interview_id)
        self.assertEqual(cancelled.status_code, 200)
        self.assertEqual(interview.status, 'cancelled')
        self.assertEqual(interview.candidate_note, 'Chiều thứ 6 được không ạ?')
        self.assertTrue(
            CandidateNotification.objects.filter(event_type='interview_updated').exists()
        )

    def test_reminders_fire_once_per_window(self):
        interview_id = self.propose(
            starts_at=(timezone.now() + timedelta(hours=20)).isoformat()
        ).data['interview']['public_id']
        self.respond(interview_id, 'accept')

        first = send_interview_reminders()
        again = send_interview_reminders()
        later = send_interview_reminders(now=timezone.now() + timedelta(hours=19, minutes=30))

        self.assertEqual((first, again, later), (1, 0, 1))
        self.assertEqual(
            CandidateNotification.objects.filter(event_type='interview_reminder').count(), 2
        )

    def test_rescheduling_an_interviewed_application_sends_a_schedule_notice(self):
        self.propose()
        CandidateNotification.objects.all().delete()

        self.propose(starts_at=(timezone.now() + timedelta(days=4)).isoformat())

        self.assertEqual(
            list(CandidateNotification.objects.values_list('event_type', flat=True)),
            ['interview_scheduled'],
        )

    def test_recruiter_reschedules_an_accepted_interview(self):
        interview_id = self.propose().data['interview']['public_id']
        self.respond(interview_id, 'accept')
        self.login(self.recruiter)
        card = next(
            item
            for item in self.client.get(
                reverse('employer-conversation-messages', args=[self.conversation_id])
            ).data['results']
            if item['kind'] == 'interview'
        )['interview']

        moved = self.propose(starts_at=(timezone.now() + timedelta(days=5)).isoformat())

        self.assertTrue(card['actions']['reschedule'])
        self.assertEqual(moved.status_code, 201, moved.data)
        self.assertEqual(
            InterviewAppointment.objects.get(public_id=interview_id).status, 'superseded'
        )
        self.application.refresh_from_db()
        self.assertIsNone(self.application.interview_ended_at)

    def test_accepting_records_when_the_interview_ends_and_cancel_clears_it(self):
        starts = timezone.now() + timedelta(days=2)
        interview_id = self.propose(starts_at=starts.isoformat()).data['interview']['public_id']

        self.respond(interview_id, 'accept')
        self.application.refresh_from_db()
        ended = self.application.interview_ended_at
        self.login(self.recruiter)
        self.client.post(
            reverse('employer-interview-cancel', args=[interview_id]), {}, format='json'
        )
        self.application.refresh_from_db()

        self.assertAlmostEqual(
            ended.timestamp(), (starts + timedelta(minutes=45)).timestamp(), delta=1
        )
        self.assertIsNone(self.application.interview_ended_at)

    def test_after_the_interview_the_recruiter_decides_on_the_card(self):
        interview_id = self.propose().data['interview']['public_id']
        self.respond(interview_id, 'accept')
        InterviewAppointment.objects.filter(public_id=interview_id).update(
            starts_at=timezone.now() - timedelta(hours=2)
        )
        self.login(self.recruiter)

        messages = self.client.get(
            reverse('employer-conversation-messages', args=[self.conversation_id])
        ).data['results']
        card = next(item for item in messages if item['kind'] == 'interview')['interview']

        self.assertTrue(card['ended'])
        self.assertTrue(card['actions']['decide'])
        self.assertFalse(card['actions']['cancel'])
        self.assertEqual(card['application_public_id'], self.application.public_id)


class BackgroundAndPrivacyTests(ConversationMixin, APITestCase):
    def send_text(self, user, portal, body):
        self.login(user)
        return self.client.post(
            reverse(f'{portal}-conversation-messages', args=[self.conversation_id]),
            {'client_id': str(uuid.uuid4()), 'body': body},
            format='json',
        )

    def test_unread_email_once_per_streak_without_message_content(self):
        enable_email_notifications()
        self.send_text(self.recruiter, 'employer', 'Nội dung bí mật')
        later = timezone.now() + timedelta(hours=1)
        mail.outbox.clear()

        first = send_unread_message_emails(now=later)
        again = send_unread_message_emails(now=later)

        self.assertEqual((first, again), (1, 0))
        self.assertEqual(mail.outbox[0].to, [self.candidate.email])
        self.assertNotIn('Nội dung bí mật', mail.outbox[0].body)
        self.assertIn(self.conversation_id, mail.outbox[0].body)

    def test_erasure_clears_content_and_keeps_the_sequence(self):
        self.send_text(self.candidate, 'candidate', 'Số điện thoại của tôi 0901')

        erased = erase_user_messages(self.candidate)

        message = Message.objects.get(sender=self.candidate)
        self.assertEqual(erased, 1)
        self.assertEqual(message.body, '')
        self.assertIsNotNone(message.erased_at)
        self.assertEqual(Conversation.objects.get().last_message_preview, '')

    def test_typing_target_only_for_members(self):
        self.assertEqual(
            typing_target(self.candidate.pk, self.conversation_id),
            (self.recruiter.pk, 'candidate'),
        )
        self.assertEqual(
            typing_target(self.recruiter.pk, self.conversation_id), (self.candidate.pk, 'recruiter')
        )
        self.assertIsNone(typing_target(self.outsider.pk, self.conversation_id))
        self.assertIsNone(typing_target(self.candidate.pk, 'cnv_missing'))

    def test_no_unread_email_to_a_recruiter_without_candidate_data_access(self):
        enable_email_notifications()
        self.send_text(self.candidate, 'candidate', 'Chào anh chị')
        mail.outbox.clear()

        with patch('apps.messaging.services.background.recruiter_may_receive', return_value=False):
            sent = send_unread_message_emails(now=timezone.now() + timedelta(hours=1))

        self.assertEqual(sent, 0)
        self.assertEqual(mail.outbox, [])
