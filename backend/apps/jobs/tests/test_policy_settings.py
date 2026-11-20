"""Luật tin tuyển dụng do admin chỉnh (ADR-0026): trần 90 ngày giữ trong code."""

from datetime import date, timedelta

from django.test import TestCase

from apps.sitecontent.models import SiteSetting

from ..domain import MAX_LISTING_DAYS
from ..services.policy import auto_reject_default_days, job_view_dedup_seconds
from ..services.posting.rules import job_deadline_error, job_deadline_policy


def _set(key, value):
    SiteSetting.objects.update_or_create(key=key, defaults={'value': value})


class JobPolicySettingsTests(TestCase):
    def test_defaults_keep_the_previous_posting_contract(self):
        self.assertEqual(
            job_deadline_policy(),
            {'default_deadline_days': 30, 'max_deadline_days': 90, 'max_public_lifetime_days': 90},
        )
        self.assertEqual(job_view_dedup_seconds(), 24 * 3600)

    def test_admin_shortens_the_deadline_window_and_server_enforces_it(self):
        _set('job_max_deadline_days', 45)
        _set('job_default_deadline_days', 60)
        today = date(2026, 11, 21)

        policy = job_deadline_policy()

        self.assertEqual(policy['max_deadline_days'], 45)
        # Mặc định không vượt được hạn tối đa.
        self.assertEqual(policy['default_deadline_days'], 45)
        self.assertEqual(job_deadline_error(today + timedelta(days=45), today=today), '')
        self.assertIn('45', job_deadline_error(today + timedelta(days=46), today=today))

    def test_admin_cannot_raise_limits_above_the_hard_ceiling(self):
        _set('job_max_deadline_days', 365)
        _set('job_max_public_lifetime_days', 365)
        _set('job_view_dedup_hours', 0)

        policy = job_deadline_policy()

        self.assertEqual(policy['max_deadline_days'], MAX_LISTING_DAYS)
        self.assertEqual(policy['max_public_lifetime_days'], MAX_LISTING_DAYS)
        self.assertEqual(job_view_dedup_seconds(), 3600)

    def test_default_auto_rejection_period_must_be_a_job_choice(self):
        _set('auto_reject_default_days', 14)
        self.assertEqual(auto_reject_default_days(), 14)
        _set('auto_reject_default_days', 9)
        self.assertEqual(auto_reject_default_days(), 21)
