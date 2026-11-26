"""Góp ý / báo lỗi người dùng: API gửi kèm ngữ cảnh thiết bị và lệnh xuất."""

import csv
import io

from django.core.cache import cache
from django.core.management import call_command
from django.urls import reverse
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.sitecontent.models import Feedback


class FeedbackApiTests(APITestCase):
    def setUp(self):
        cache.clear()

    def test_guest_reports_a_bug_with_cleaned_device_context(self):
        response = self.client.post(
            reverse('site-feedback'),
            {
                'category': 'bug',
                'content': 'Bấm Lưu CV trên iPhone không phản hồi gì cả.',
                'page_url': '/cvs/cv_1/edit?mode=create',
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
