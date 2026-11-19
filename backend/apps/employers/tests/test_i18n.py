"""Bilingual employer responses, notices and emails (ADR-0023)."""

from django.core import mail
from django.test import TestCase
from django.urls import reverse
from django.utils import translation
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import User

from ..models import EmployerNotification, EmployerVerificationNotification
from ..services import emit_employer_event
from ..services.company_membership import request_company_join
from ..tasks.verification_notification import _send
from .factories import add_recruiter, make_company


def _employer(email, language='vi'):
    return User.objects.create_user(
        email=email,
        password='Password@123',
        role=User.Role.EMPLOYER,
        preferred_language=language,
    )


class EmployerApiLanguageTests(APITestCase):
    def setUp(self):
        self.client.force_authenticate(_employer('i18n-api@example.com'))

    def test_error_message_follows_accept_language(self):
        url = reverse('employer-notification-read', kwargs={'public_id': 'eno_missing'})

        vi = self.client.post(url)
        en = self.client.post(url, HTTP_ACCEPT_LANGUAGE='en')

        self.assertEqual(vi.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(vi.json()['detail'], 'Không tìm thấy thông báo.')
        self.assertEqual(en.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(en.json()['detail'], 'Notification not found.')

    def test_catalog_labels_follow_accept_language(self):
        url = reverse('employer-company-catalogs')

        # ``.json()``: ``.data`` still holds lazy labels that would render in
        # whatever language the test thread has active by the time it asserts.
        vi = self.client.get(url).json()['company_sizes'][0]
        en = self.client.get(url, HTTP_ACCEPT_LANGUAGE='en').json()['company_sizes'][0]

        self.assertEqual(vi, {'value': '1-9', 'label': '1 - 9 nhân viên'})
        self.assertEqual(en, {'value': '1-9', 'label': '1 - 9 employees'})


class EmployerNoticeLanguageTests(TestCase):
    def test_notice_is_stored_in_the_recipient_language(self):
        english = _employer('i18n-notice-en@example.com', 'en')
        vietnamese = _employer('i18n-notice-vi@example.com', 'vi')

        # The actor's language must not leak into someone else's notice.
        with translation.override('vi'):
            en_notice, en_activity = emit_employer_event(
                recipient=english,
                event_type=EmployerNotification.EventType.VERIFICATION_APPROVED,
                dedupe_key='i18n:en',
            )
        with translation.override('en'):
            vi_notice, _activity = emit_employer_event(
                recipient=vietnamese,
                event_type=EmployerNotification.EventType.VERIFICATION_APPROVED,
                dedupe_key='i18n:vi',
            )

        self.assertEqual(en_notice.title, 'Verification approved')
        self.assertEqual(en_activity.summary, 'Verification approved')
        self.assertEqual(vi_notice.title, 'Hồ sơ xác thực đã được duyệt')

    def test_formatted_notice_message_uses_the_recipient_language(self):
        requester = _employer('i18n-requester@example.com', 'vi')
        requester.full_name = 'Nguyễn An'
        requester.save(update_fields=['full_name'])
        company = make_company(requester, name='Acme Vietnam')
        owner = add_recruiter(company)
        owner.preferred_language = 'en'
        owner.save(update_fields=['preferred_language'])

        with translation.override('vi'):
            request_company_join(requester, company.public_id)

        notice = EmployerNotification.objects.get(
            recipient=owner, event_type=EmployerNotification.EventType.COMPANY_JOIN_REQUESTED
        )
        self.assertEqual(notice.title, 'New request to join the company')
        self.assertEqual(notice.message, 'Nguyễn An wants to join Acme Vietnam.')


class VerificationEmailLanguageTests(TestCase):
    def _send(self, recipient):
        _send(
            EmployerVerificationNotification(
                recipient=recipient,
                event_type='approved',
                context={'reason': ''},
            )
        )
        return mail.outbox[-1]

    def test_email_is_rendered_in_the_recipient_language(self):
        with translation.override('vi'):
            english = self._send(_employer('i18n-mail-en@example.com', 'en'))
        with translation.override('en'):
            vietnamese = self._send(_employer('i18n-mail-vi@example.com', 'vi'))

        self.assertTrue(english.subject.startswith('Verification approved · '))
        self.assertIn('You can now submit job postings for moderation', english.body)
        self.assertIn('Open the verification page', english.alternatives[0][0])
        self.assertTrue(vietnamese.subject.startswith('Hồ sơ xác thực đã được duyệt · '))
        self.assertIn('Mở trang xác thực', vietnamese.alternatives[0][0])
