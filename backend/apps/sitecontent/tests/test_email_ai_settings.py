"""Email & AI settings của GĐ4 (ADR-0026): một nguồn cho người gửi, công tắc và lựa chọn."""

from email.header import decode_header, make_header
from email.utils import getaddresses

from django.core.mail import EmailMessage
from django.test import TestCase, override_settings

from apps.accounts.models import User
from apps.accounts.tasks.auth_email import queue_welcome_email
from apps.applications.services.reminders import send_unanswered_application_reminders
from apps.campaigns.services.content import ai_campaign_content_enabled
from apps.jobs.domain.ai_policy import resolve_job_ai_policy
from apps.jobs.services.digests.eligibility import site_email_enabled

from ..api.serializers import AdminSiteSettingSerializer
from ..models import SiteSetting
from ..selectors import email_sender
from ..services import update_site_settings


def _set(key, value, value_type=SiteSetting.ValueType.BOOLEAN):
    SiteSetting.objects.update_or_create(
        key=key, defaults={'value': value, 'value_type': value_type}
    )


@override_settings(EMAIL_FROM_ADDRESS='no-reply@procv.vn')
class EmailSettingsTests(TestCase):
    def test_every_email_uses_the_configured_sender_and_reply_to(self):
        _set('email_from_name', 'Tuyển dụng ProCV', SiteSetting.ValueType.TEXT)
        _set('support_email', 'hotro@procv.vn', SiteSetting.ValueType.EMAIL)

        self.assertEqual(
            email_sender(),
            {'from_email': 'Tuyển dụng ProCV <no-reply@procv.vn>', 'reply_to': 'hotro@procv.vn'},
        )

    def test_company_sender_keeps_our_address_and_survives_header_parsing(self):
        _set('email_from_name', 'ProCV', SiteSetting.ValueType.TEXT)
        sender = email_sender('Công ty "Gấu", chi nhánh\r\nBcc: x@evil.test')

        header = EmailMessage('s', 'b', sender['from_email'], ['a@example.com']).message()['From']
        # Một địa chỉ duy nhất (dấu phẩy/xuống dòng không tách header), vẫn là địa chỉ của ta.
        self.assertEqual([address for _, address in getaddresses([header])], ['no-reply@procv.vn'])
        encoded_name = header.rsplit(' <', 1)[0]
        self.assertEqual(
            str(make_header(decode_header(encoded_name))),
            'Công ty "Gấu", chi nhánh Bcc: x@evil.test qua ProCV',
        )

    def test_company_sender_is_truncated_and_follows_the_switch(self):
        long_name = 'Công ty TNHH Một thành viên Thương mại Dịch vụ Xuất nhập khẩu Panda'
        self.assertEqual(
            email_sender(long_name)['from_email'],
            f'{long_name[:59].rstrip()}… qua ProCV <no-reply@procv.vn>',
        )

        _set('email_company_sender_enabled', False)
        self.assertEqual(email_sender('Panda')['from_email'], 'ProCV <no-reply@procv.vn>')

    def test_welcome_switch_stops_queueing_the_welcome_email(self):
        user = User.objects.create_user(email='new@example.com', password='Password@123')
        _set('email_welcome_enabled', False)

        self.assertIsNone(queue_welcome_email(user))

    def test_job_alert_emails_need_both_switches(self):
        self.assertTrue(site_email_enabled())
        _set('job_alert_enabled', False)
        self.assertFalse(site_email_enabled())

    def test_recruiter_reminders_switch(self):
        _set('recruiter_reminders_enabled', False)

        self.assertEqual(send_unanswered_application_reminders(), 0)


@override_settings(
    AI_RUNTIME_ENABLED=True,
    AI_JOB_GENERATION_MODEL='gemini-a',
    AI_JOB_GENERATION_MODEL_ALLOWLIST=('gemini-a', 'gemini-b'),
)
class AiSettingsTests(TestCase):
    def test_master_ai_switch_closes_job_generation_and_campaign_writing(self):
        values = {'ai_job_generation_enabled': True, 'ai_enabled': True}
        self.assertTrue(resolve_job_ai_policy(values).soft_switch_enabled)
        self.assertTrue(ai_campaign_content_enabled())

        self.assertFalse(resolve_job_ai_policy({**values, 'ai_enabled': False}).soft_switch_enabled)
        _set('ai_enabled', False)
        self.assertFalse(ai_campaign_content_enabled())

    def test_model_choices_come_from_the_server_allowlist(self):
        _set('ai_job_generation_model', 'gemini-a', SiteSetting.ValueType.SELECT)
        setting = SiteSetting.objects.get(key='ai_job_generation_model')
        actor = User.objects.create_user(
            email='root@example.com', password='Password@123', role=User.Role.ADMIN
        )

        choices = AdminSiteSettingSerializer(setting).data['options']['choices']
        self.assertEqual([choice['value'] for choice in choices], ['gemini-a', 'gemini-b'])
        ok = update_site_settings(
            actor=actor, values={'ai_job_generation_model': 'gemini-b'}, image_uploads={}
        )
        bad = update_site_settings(
            actor=actor, values={'ai_job_generation_model': 'gpt-x'}, image_uploads={}
        )
        self.assertEqual(ok.updated, ['ai_job_generation_model'])
        self.assertIn('ai_job_generation_model', bad.errors)
