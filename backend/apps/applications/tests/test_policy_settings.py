"""Luật ứng tuyển do admin chỉnh (ADR-0026): đọc đúng key, kẹp trong khoảng an toàn."""

from datetime import timedelta

from django.test import TestCase

from apps.sitecontent.models import SiteSetting

from ..services import application_rules, policy


def _set(key, value):
    SiteSetting.objects.update_or_create(key=key, defaults={'value': value})


class ApplicationPolicySettingsTests(TestCase):
    def test_defaults_match_the_previous_hard_coded_rules(self):
        self.assertEqual(policy.max_applications_per_job(), 3)
        self.assertEqual(policy.reapply_cooldown(), timedelta(minutes=5))
        self.assertEqual(policy.system_reminder_days(), (3, 7))
        self.assertEqual(
            policy.candidate_reminder_policy(),
            (timedelta(days=3), timedelta(days=3), 2),
        )

    def test_admin_values_reach_the_rules_the_clients_display(self):
        _set('application_max_per_job', 1)
        _set('application_reapply_cooldown_minutes', 30)
        _set('candidate_reminder_after_days', 5)
        _set('candidate_reminder_max', 0)
        _set('auto_reject_default_days', 14)
        _set('auto_reject_min_notice_days', 2)
        _set('auto_reject_email_grace_days', 1)

        rules = application_rules()

        self.assertEqual(rules['max_submissions_per_job'], 1)
        self.assertEqual(rules['reapply_cooldown_seconds'], 1800)
        self.assertEqual(rules['candidate_reminder_after_days'], 5)
        self.assertEqual(rules['max_candidate_reminders'], 0)
        self.assertEqual(rules['auto_reject_default_days'], 14)
        self.assertEqual(rules['auto_rejection_warning_days'], 2)
        self.assertEqual(rules['auto_rejection_email_grace_days'], 1)

    def test_out_of_range_values_are_clamped_instead_of_breaking_the_flow(self):
        _set('application_max_per_job', 0)
        _set('candidate_status_notify_delay_minutes', 999)
        _set('review_link_max_days', -4)

        self.assertEqual(policy.max_applications_per_job(), 1)
        self.assertEqual(policy.candidate_status_notification_delay(), timedelta(minutes=60))
        self.assertEqual(policy.review_link_max_days(), 1)

    def test_recruiter_reminder_days_are_sorted_unique_and_in_range(self):
        _set('recruiter_reminder_days', [7, 3, 7, 0, 90, 'x', 14])

        self.assertEqual(policy.system_reminder_days(), (3, 7, 14))
