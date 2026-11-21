"""Hạn lời mời quản trị viên do admin chỉnh, kẹp trong 24 giờ – 14 ngày (ADR-0026)."""

from datetime import timedelta

from django.test import TestCase

from apps.sitecontent.models import SiteSetting

from ..services.admin_invitations import invitation_ttl


class AdminInvitationTtlSettingTests(TestCase):
    def test_ttl_follows_admin_value_within_bounds(self):
        self.assertEqual(invitation_ttl(), timedelta(hours=72))
        for value, expected in ((48, 48), (1, 24), (10_000, 14 * 24)):
            with self.subTest(value=value):
                SiteSetting.objects.update_or_create(
                    key='admin_invitation_ttl_hours', defaults={'value': value}
                )
                self.assertEqual(invitation_ttl(), timedelta(hours=expected))
