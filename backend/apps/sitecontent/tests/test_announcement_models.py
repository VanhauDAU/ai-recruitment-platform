from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.test import TestCase
from django.utils import timezone

from apps.accounts.models import User

from ..models import (
    Announcement,
    AnnouncementDailyMetric,
    AnnouncementRevision,
    AnnouncementUserState,
)
from ..services import create_announcement
from .announcement_helpers import revision_payload


class AnnouncementModelTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            email='announcement-model-admin@example.com',
            password='Password@123',
            role=User.Role.ADMIN,
            is_superuser=True,
        )

    def test_public_id_and_first_revision_are_created_with_safe_defaults(self):
        announcement = create_announcement(
            actor=self.admin,
            internal_name='  Ra mắt tính năng  ',
            revision_data=revision_payload(),
        )

        revision = announcement.revisions.get()
        self.assertTrue(announcement.public_id.startswith('ann_'))
        self.assertEqual(announcement.internal_name, 'Ra mắt tính năng')
        self.assertEqual(announcement.lifecycle_state, Announcement.LifecycleState.DRAFT)
        self.assertEqual(announcement.revision_token, 1)
        self.assertEqual(revision.number, 1)
        self.assertIsNone(revision.published_at)

    def test_critical_revision_requires_end_time_and_locked_dismiss(self):
        announcement = Announcement.objects.create(
            internal_name='Critical',
            created_by=self.admin,
        )
        revision = AnnouncementRevision(
            announcement=announcement,
            number=1,
            message_vi='Sự cố hệ thống.',
            kind=AnnouncementRevision.Kind.CRITICAL,
            surfaces=[AnnouncementRevision.Surface.CANDIDATE],
            auth_audiences=[AnnouncementRevision.Audience.GUEST],
            dismiss_mode=AnnouncementRevision.DismissMode.CLOSE,
        )

        with self.assertRaises(ValidationError) as raised:
            revision.full_clean()

        self.assertIn('ends_at', raised.exception.message_dict)
        self.assertIn('dismiss_mode', raised.exception.message_dict)

    def test_user_state_and_daily_metric_uniqueness_are_database_enforced(self):
        user = User.objects.create_user(
            email='announcement-candidate@example.com',
            password='Password@123',
        )
        announcement = create_announcement(
            actor=self.admin,
            internal_name='Đo lường',
            revision_data=revision_payload(),
        )
        revision = announcement.revisions.get()
        AnnouncementUserState.objects.create(
            user=user,
            announcement=announcement,
            dismissal_version=1,
            dismissed_at=timezone.now(),
        )
        with self.assertRaises(IntegrityError), transaction.atomic():
            AnnouncementUserState.objects.create(
                user=user,
                announcement=announcement,
                dismissal_version=1,
            )

        today = timezone.localdate()
        AnnouncementDailyMetric.objects.create(
            announcement_revision=revision,
            date=today,
            surface=AnnouncementRevision.Surface.CANDIDATE,
        )
        with self.assertRaises(IntegrityError), transaction.atomic():
            AnnouncementDailyMetric.objects.create(
                announcement_revision=revision,
                date=today,
                surface=AnnouncementRevision.Surface.CANDIDATE,
            )
