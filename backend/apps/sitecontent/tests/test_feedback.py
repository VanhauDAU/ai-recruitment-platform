"""Góp ý / báo lỗi người dùng: API gửi kèm ngữ cảnh thiết bị và lệnh xuất."""

import csv
import io
from unittest import mock

from django.core.cache import cache
from django.core.management import call_command
from django.test import override_settings
from django.urls import reverse
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.sitecontent.models import Feedback
from apps.sitecontent.services.feedback_telegram import (
    TelegramDeliveryError,
    feedback_message,
    send_feedback_to_telegram,
)


class FeedbackApiTests(APITestCase):
    def setUp(self):
        cache.clear()

    def test_guest_reports_a_bug_with_cleaned_device_context(self):
        response = self.client.post(
            reverse('site-feedback'),
            {
                'category': 'bug',
                'content': 'Bấm Lưu CV trên iPhone không phản hồi gì cả.',
                'page_url': '/cv/cv_1/chinh-sua?mode=create',
                'client_info': {
                    'viewport': '390x844',
                    'standalone': True,
                    'dpr': 3,
                    'user_agent': 'x' * 1000,
                    'nested': {'dropped': True},
                },
            },
            format='json',
        )

        self.assertEqual(response.status_code, 201, response.data)
        feedback = Feedback.objects.get()
        self.assertEqual(feedback.category, Feedback.Category.BUG)
        self.assertIsNone(feedback.user)
        self.assertEqual(feedback.client_info['viewport'], '390x844')
        self.assertIs(feedback.client_info['standalone'], True)
        self.assertEqual(len(feedback.client_info['user_agent']), 300)
        self.assertNotIn('nested', feedback.client_info)

    def test_rejects_non_object_device_context(self):
        response = self.client.post(
            reverse('site-feedback'),
            {'category': 'bug', 'content': 'Nội dung đủ dài để gửi.', 'client_info': ['x']},
            format='json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn('client_info', response.data)


class ExportFeedbackCommandTests(APITestCase):
    def setUp(self):
        user = User.objects.create_user(
            email='an@example.com', password='Secret123!', role='candidate'
        )
        self.bug = Feedback.objects.create(
            user=user,
            category=Feedback.Category.BUG,
            content='Header bị tràn trên iPhone.\nAvatar bị cắt.',
            page_url='/viec-lam',
            client_info={'viewport': '390x844', 'standalone': True},
        )
        self.done = Feedback.objects.create(
            category=Feedback.Category.FEATURE,
            content='Đã xử lý xong từ trước.',
            status=Feedback.Status.RESOLVED,
        )

    def test_markdown_lists_new_feedback_with_device_and_page(self):
        out = io.StringIO()
        call_command('export_feedback', stdout=out)
        text = out.getvalue()

        self.assertIn('# Góp ý người dùng (1)', text)
        self.assertIn('## Báo lỗi (1)', text)
        self.assertIn('an@example.com', text)
        self.assertIn('`/viec-lam`', text)
        self.assertIn('màn 390x844 · web app', text)
        self.assertIn('> Avatar bị cắt.', text)
        self.assertNotIn('Đã xử lý xong', text)

    def test_csv_exports_every_status_and_marks_new_ones_in_progress(self):
        out = io.StringIO()
        call_command(
            'export_feedback',
            '--status',
            'all',
            '--format',
            'csv',
            '--mark-in-progress',
            stdout=out,
        )

        rows = list(csv.DictReader(io.StringIO(out.getvalue())))
        self.assertEqual([row['id'] for row in rows], [str(self.bug.id), str(self.done.id)])
        self.assertEqual(rows[0]['category'], 'Báo lỗi')
        self.bug.refresh_from_db()
        self.done.refresh_from_db()
        self.assertEqual(self.bug.status, Feedback.Status.IN_PROGRESS)
        self.assertEqual(self.done.status, Feedback.Status.RESOLVED)


class FeedbackTelegramTests(APITestCase):
    def setUp(self):
        cache.clear()

    def _bug(self, **extra):
        return Feedback.objects.create(
            category=Feedback.Category.BUG,
            content='Nút <Lưu> & chữ "đè" nhau trên iPhone.',
            page_url='/cv/cv_1/chinh-sua',
            client_info={'viewport': '390x844', 'standalone': True},
            **extra,
        )

    def test_message_is_escaped_html_with_page_and_device(self):
        text = feedback_message(self._bug(phone='0909123456'))

        self.assertIn('🐞 <b>Báo lỗi</b>', text)
        self.assertIn('https://procv.site/cv/cv_1/chinh-sua', text)
        self.assertIn('màn 390x844 · web app', text)
        self.assertIn('Nút &lt;Lưu&gt; &amp; chữ &quot;đè&quot;', text)
        self.assertIn('0909123456', text)

    @override_settings(TELEGRAM_BOT_TOKEN='', TELEGRAM_FEEDBACK_CHAT_ID='')
    def test_nothing_is_sent_without_configuration(self):
        session = mock.Mock()
        self.assertFalse(send_feedback_to_telegram(self._bug().id, session=session))
        session.post.assert_not_called()

    @override_settings(TELEGRAM_BOT_TOKEN='123:abc', TELEGRAM_FEEDBACK_CHAT_ID='42')
    def test_sends_to_the_configured_chat_and_retries_on_server_errors(self):
        feedback = self._bug()
        session = mock.Mock()
        session.post.return_value = mock.Mock(status_code=200)

        self.assertTrue(send_feedback_to_telegram(feedback.id, session=session))
        (url,) = session.post.call_args.args
        payload = session.post.call_args.kwargs['json']
        self.assertEqual(url, 'https://api.telegram.org/bot123:abc/sendMessage')
        self.assertEqual(payload['chat_id'], '42')
        self.assertEqual(payload['parse_mode'], 'HTML')

        session.post.return_value = mock.Mock(status_code=502)
        with self.assertRaises(TelegramDeliveryError):
            send_feedback_to_telegram(feedback.id, session=session)
        session.post.return_value = mock.Mock(status_code=401)
        self.assertFalse(send_feedback_to_telegram(feedback.id, session=session))

    @override_settings(TELEGRAM_BOT_TOKEN='123:abc', TELEGRAM_FEEDBACK_CHAT_ID='42')
    def test_submitting_feedback_enqueues_the_notice_after_commit(self):
        with mock.patch('apps.sitecontent.tasks.notify_feedback_telegram.delay') as delay:
            with self.captureOnCommitCallbacks(execute=True):
                response = self.client.post(
                    reverse('site-feedback'),
                    {'category': 'bug', 'content': 'Lỗi đủ dài để gửi đi.'},
                    format='json',
                )

        self.assertEqual(response.status_code, 201, response.data)
        delay.assert_called_once_with(Feedback.objects.get().id)
