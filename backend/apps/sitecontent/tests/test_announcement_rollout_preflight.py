import json
from io import StringIO

from django.core.management import CommandError, call_command
from django.test import TestCase, override_settings

from apps.accounts.models import User

from ..services import create_announcement, publish_announcement
from .announcement_helpers import revision_payload


@override_settings(ANNOUNCEMENT_REMOTE_ENABLED_SURFACES=('candidate',))
class AnnouncementRolloutPreflightTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            email='announcement-preflight-admin@example.com',
            password='Password@123',
            role=User.Role.ADMIN,
            is_superuser=True,
        )

    def publish(self, internal_name):
        announcement = create_announcement(
            actor=self.admin,
            internal_name=internal_name,
            revision_data=revision_payload(priority=80),
        )
        return publish_announcement(
            announcement=announcement,
            actor=self.admin,
            revision_number=1,
            expected_revision_token=1,
        )

    def test_json_report_exposes_live_counts_and_rotation_groups(self):
        first = self.publish('Conflict rehearsal A')
        second = self.publish('Conflict rehearsal B')
        output = StringIO()

        call_command(
            'announcement_rollout_preflight',
            as_json=True,
            require_live_surface=['candidate'],
            stdout=output,
        )

        report = json.loads(output.getvalue())
        self.assertEqual(report['status'], 'ok')
        self.assertEqual(report['live_by_surface']['candidate'], 2)
        self.assertEqual(
            report['rotation_groups'][0]['public_ids'],
            sorted([first.public_id, second.public_id]),
        )

    def test_required_live_surface_fails_closed(self):
        with self.assertRaises(CommandError):
            call_command(
                'announcement_rollout_preflight',
                require_live_surface=['candidate'],
                stdout=StringIO(),
                stderr=StringIO(),
            )
