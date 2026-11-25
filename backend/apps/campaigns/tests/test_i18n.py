"""Bilingual campaigns (ADR-0023): API text follows the request, mail the recipient."""

from datetime import datetime
from io import BytesIO
from types import SimpleNamespace
from unittest.mock import patch

from django.core import mail
from django.test import TestCase, override_settings
from django.urls import reverse

from apps.employers.models import EmployerNotification
from common.vietnam_time import VIETNAM_TZ

from ..services import send_weekly_reports, snapshot_campaign
from .test_channels import ChannelTestMixin
from .test_health import NOW, HealthFixtures, S

EN = {'HTTP_ACCEPT_LANGUAGE': 'en'}
AI_POST = {
    'headline': 'Join us',
    'body': 'Apply: {link}',
    'hashtags': ['hiring'],
    'call_to_action': 'Apply now: {link}',
}


class CampaignChannelLanguageTests(ChannelTestMixin, TestCase):
    def test_api_messages_and_labels_follow_accept_language(self):
        self.add_channel()

        duplicate = self.client.post(
            self.channels_url(), {'kind': 'zalo', 'label': 'nhóm it hà nội'}, format='json', **EN
        )
        listed_en = self.client.get(self.channels_url(), **EN)
        listed_vi = self.client.get(self.channels_url())

        self.assertEqual(duplicate.status_code, 400)
        self.assertEqual(
            str(duplicate.data['label']), 'This campaign already has a channel with the same name.'
        )
        self.assertEqual(listed_en.data[0]['kind_label'], 'Facebook group')
        self.assertEqual(listed_vi.data[0]['kind_label'], 'Nhóm Facebook')

    @override_settings(AI_RUNTIME_ENABLED=False)
    def test_template_content_is_written_in_the_request_language(self):
        self.make_active_job(campaign=self.campaign)
        channel = self.add_channel()
        url = self.channel_url('employer-campaign-channel-content', channel)

        english = self.client.post(url, **EN).data['content']
        vietnamese = self.client.post(url).data['content']

        self.assertEqual(set(english), {'headline', 'body', 'hashtags', 'call_to_action'})
        self.assertIn('is hiring: Tuyển kỹ thuật quý 1', english['headline'])
        self.assertIn('Apply here: {link}', english['body'])
        self.assertEqual(english['hashtags'], ['hiring', 'jobs'])
        self.assertIn('đang tuyển dụng: Tuyển kỹ thuật quý 1', vietnamese['headline'])
        self.assertEqual(vietnamese['hashtags'], ['tuyendung', 'vieclam'])

    @override_settings(AI_RUNTIME_ENABLED=True)
    def test_ai_is_asked_to_write_in_the_request_language(self):
        self.make_active_job(campaign=self.campaign)
        channel = self.add_channel()
        url = self.channel_url('employer-campaign-channel-content', channel)

        with patch(
            'apps.campaigns.services.content.generate_structured',
            return_value=SimpleNamespace(data=AI_POST),
        ) as generate:
            english = self.client.post(url, **EN)
            self.client.post(url)

        en_call, vi_call = (call.kwargs for call in generate.call_args_list)
        self.assertEqual(english.status_code, 200, english.data)
        self.assertEqual(english.data['content_source'], 'ai')
        self.assertEqual(english.data['content']['headline'], 'Join us')
        self.assertIn('bằng tiếng Anh', en_call['system_instruction'])
        self.assertIn('bằng tiếng Anh', en_call['prompt'])
        self.assertIn('bằng tiếng Việt', vi_call['system_instruction'])
        self.assertIn('bằng tiếng Việt', vi_call['prompt'])


class CampaignRecipientLanguageTests(HealthFixtures, TestCase):
    def prefer_english(self):
        self.user.preferred_language = 'en'
        self.user.save(update_fields=['preferred_language'])

    def test_weekly_report_email_uses_the_owner_language(self):
        self.prefer_english()

        send_weekly_reports(now=datetime(2026, 11, 23, 9, 0, tzinfo=VIETNAM_TZ))

        message = mail.outbox[0]
        html = message.alternatives[0][0]
        self.assertEqual(message.subject, 'Weekly report: Tuyển kỹ thuật')
        self.assertIn('New applications in the last 7 days: 0', message.body)
        self.assertIn('Turn off this email in Account settings', message.body)
        self.assertIn('<html lang="en">', html)
        self.assertIn('View campaign details', html)
        self.assertNotIn('Báo cáo tuần', message.body + html)

    def test_health_alert_notice_uses_the_owner_language(self):
        self.prefer_english()
        for _ in range(5):
            self.apply(S.SUBMITTED, days_ago=3)

        snapshot_campaign(self.campaign, now=NOW)

        notice = EmployerNotification.objects.get(
            event_type=EmployerNotification.EventType.CAMPAIGN_HEALTH_ALERT,
            metadata__rule='backlog',
        )
        self.assertEqual(
            notice.message,
            '5 application(s) in campaign "Tuyển kỹ thuật" have waited more than 48 hours '
            'without being viewed.',
        )

    def report_url(self):
        return reverse(
            'employer-campaign-report-export', kwargs={'public_id': self.campaign.public_id}
        )

    def test_report_files_follow_the_request_language(self):
        from openpyxl import load_workbook

        self.seed_pipeline()
        workbook = load_workbook(
            BytesIO(self.client.get(self.report_url(), {'type': 'xlsx'}, **EN).content)
        )
        pdf_url = reverse(
            'employer-campaign-report-pdf', kwargs={'public_id': self.campaign.public_id}
        )
        with (
            patch(
                'apps.campaigns.services.report_export.render_html_pdf', return_value=b'%PDF-1.7'
            ) as render,
            self.captureOnCommitCallbacks(execute=True),
        ):
            # The worker renders in the language of the request that queued it.
            self.client.post(pdf_url, **EN)

        self.assertEqual(
            workbook.sheetnames,
            ['Overview', 'Funnel', 'Sources and costs', 'By day', 'Job posting'],
        )
        self.assertEqual(workbook['Funnel']['A2'].value, 'Applied')
        html = render.call_args.args[0]
        self.assertIn('Recruitment campaign report: Tuyển kỹ thuật', html)
        self.assertIn('<html lang="en">', html)
