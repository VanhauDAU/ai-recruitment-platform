"""Cấu hình xác thực & uy tín NTD do admin chỉnh (ADR-0026)."""

from django.test import TestCase, override_settings

from apps.jobs.models import JobReport
from apps.sitecontent.models import SiteSetting
from apps.sitecontent.selectors import (
    approved_employer_verification_required,
    moderation_sla_hours,
    report_sla_hours,
    retention_days,
)

from ..services.companies import normalize_company_rich_text
from ..services.trust_badge import badge_policy_mode, trust_report_reasons
from ..services.verification.cases import max_final_rejections


def _set(key, value):
    SiteSetting.objects.update_or_create(key=key, defaults={'value': value})


class EmployerPolicySettingsTests(TestCase):
    @override_settings(REQUIRE_APPROVED_EMPLOYER_VERIFICATION=False)
    def test_admin_switch_tightens_verification_when_the_server_does_not(self):
        self.assertFalse(approved_employer_verification_required())

        _set('employer_require_approved_verification', True)

        self.assertTrue(approved_employer_verification_required())

    @override_settings(REQUIRE_APPROVED_EMPLOYER_VERIFICATION=True)
    def test_admin_switch_cannot_relax_the_server_requirement(self):
        _set('employer_require_approved_verification', False)

        self.assertTrue(approved_employer_verification_required())

    @override_settings(EMPLOYER_BADGE_POLICY_MODE='shadow')
    def test_badge_mode_follows_admin_choice_and_falls_back_to_the_server(self):
        self.assertEqual(badge_policy_mode(), 'shadow')
        _set('employer_badge_policy_mode', 'enforce')
        self.assertEqual(badge_policy_mode(), 'enforce')
        _set('employer_badge_policy_mode', 'nonsense')
        self.assertEqual(badge_policy_mode(), 'shadow')

    def test_trust_report_reasons_keep_only_known_reasons(self):
        self.assertIn(JobReport.Reason.SCAM, trust_report_reasons())

        _set('employer_trust_report_reasons', [JobReport.Reason.SCAM, 'made_up'])

        self.assertEqual(trust_report_reasons(), (JobReport.Reason.SCAM,))

    def test_rejection_cap_and_sla_hours_are_clamped(self):
        _set('employer_verification_max_rejections', 50)
        _set('moderation_sla_hours', 1)
        _set('report_sla_hours', 24)

        self.assertEqual(max_final_rejections(), 10)
        self.assertEqual(moderation_sla_hours(), 12)
        self.assertEqual(report_sla_hours(), 24)

    def test_company_description_minimum_comes_from_admin(self):
        _set('company_description_min_length', 20)

        self.assertTrue(
            normalize_company_rich_text('<p>' + 'a' * 20 + '</p>', required=True, label='Mô tả')
        )
        with self.assertRaisesMessage(ValueError, '20'):
            normalize_company_rich_text('<p>ngắn</p>', required=True, label='Mô tả')

    def test_retention_can_only_shorten_and_keeps_its_floor(self):
        _set('candidate_notification_retention_days', 9999)
        self.assertEqual(retention_days('candidate_notification_retention_days', 730, 30), 730)
        _set('candidate_notification_retention_days', 5)
        self.assertEqual(retention_days('candidate_notification_retention_days', 730, 30), 30)
