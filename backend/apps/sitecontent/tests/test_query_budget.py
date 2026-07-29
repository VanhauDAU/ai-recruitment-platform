"""Query budgets for public site-content collections."""

from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.jobs.models import JobCategory
from apps.locations.models import Location

from ..models import AnnouncementUserState, LinkGroup, LinkItem
from ..selectors import admin_announcements_queryset
from ..services import (
    create_announcement,
    create_announcement_revision,
    publish_announcement,
)
from .announcement_helpers import revision_payload

LINK_GROUP_LIST_QUERY_BUDGET = 4
ACTIVE_ANNOUNCEMENT_FEED_QUERY_BUDGET = 1
ADMIN_ANNOUNCEMENT_LIST_QUERY_BUDGET = 2
# Detail cần một query bổ sung, phẳng theo số audit event, để trả read-only
# revision history và audit history trong cùng workspace AN-P3.
ADMIN_ANNOUNCEMENT_DETAIL_QUERY_BUDGET = 3
ADMIN_ANNOUNCEMENT_METRIC_QUERY_BUDGET = 2


class LinkGroupQueryBudgetTests(APITestCase):
    def setUp(self):
        for index, name in enumerate(('Hà Nội', 'Đà Nẵng', 'Tỉnh Bình Dương')):
            Location.objects.create(
                code=f'province-{index}',
                name=name,
                level=Location.Level.PROVINCE,
                is_active=True,
            )
        for index, name in enumerate(('Backend', 'Frontend', 'Data')):
            JobCategory.objects.create(
                name=name,
                slug=f'category-{index}',
                status=JobCategory.Status.ACTIVE,
            )

        for index in range(2):
            manual = LinkGroup.objects.create(
                key=f'manual-{index}',
                title=f'Manual {index}',
                source=LinkGroup.Source.MANUAL,
                placement=LinkGroup.Placement.FOOTER_SEO,
                order=index,
            )
            LinkItem.objects.create(group=manual, label='Đang bật', url='/active', order=1)
            LinkItem.objects.create(
                group=manual,
                label='Đã tắt',
                url='/inactive',
                order=2,
                is_active=False,
            )
            LinkGroup.objects.create(
                key=f'locations-{index}',
                title=f'Locations {index}',
                source=LinkGroup.Source.LOCATIONS,
                placement=LinkGroup.Placement.FOOTER_SEO,
                limit=index + 1,
                order=10 + index,
            )
            LinkGroup.objects.create(
                key=f'categories-{index}',
                title=f'Categories {index}',
                source=LinkGroup.Source.CATEGORIES,
                placement=LinkGroup.Placement.FOOTER_SEO,
                limit=index + 1,
                order=20 + index,
            )

    def test_query_count_is_flat_across_groups_of_the_same_source(self):
        with self.assertNumQueries(LINK_GROUP_LIST_QUERY_BUDGET):
            response = self.client.get(
                reverse('site-link-groups'),
                {'placement': LinkGroup.Placement.FOOTER_SEO},
            )

        self.assertEqual(response.status_code, 200)
        groups = {group['key']: group for group in response.data}
        self.assertEqual([item['label'] for item in groups['manual-0']['items']], ['Đang bật'])
        self.assertEqual(len(groups['locations-0']['items']), 1)
        self.assertEqual(len(groups['locations-1']['items']), 2)
        self.assertEqual(len(groups['categories-0']['items']), 1)
        self.assertEqual(len(groups['categories-1']['items']), 2)


class AnnouncementQueryBudgetTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            email='announcement-query-admin@example.com',
            password='Password@123',
            role=User.Role.ADMIN,
            is_superuser=True,
        )
        for index in range(8):
            announcement = create_announcement(
                actor=self.admin,
                internal_name=f'Thông báo {index}',
                revision_data=revision_payload(priority=index),
            )
            publish_announcement(
                announcement=announcement,
                actor=self.admin,
                revision_number=1,
                expected_revision_token=1,
            )

    def test_public_feed_query_count_is_flat(self):
        with self.assertNumQueries(ACTIVE_ANNOUNCEMENT_FEED_QUERY_BUDGET):
            response = self.client.get(
                reverse('site-announcements-active'),
                {'surface': 'candidate', 'path': '/'},
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data['items']), 8)

    def test_personalized_feed_keeps_one_query_with_dismiss_state(self):
        user = User.objects.create_user(
            email='announcement-query-candidate@example.com',
            password='Password@123',
            role=User.Role.CANDIDATE,
        )
        first = next(iter(admin_announcements_queryset()))
        AnnouncementUserState.objects.create(
            user=user,
            announcement=first,
            dismissal_version=first.dismissal_version,
            dismissed_at=timezone.now(),
        )
        self.client.force_authenticate(user)

        with self.assertNumQueries(ACTIVE_ANNOUNCEMENT_FEED_QUERY_BUDGET):
            response = self.client.get(
                reverse('site-announcements-active'),
                {'surface': 'candidate', 'path': '/'},
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data['items']), 7)

    def test_admin_list_query_count_is_flat(self):
        self.client.force_authenticate(self.admin)
        with self.assertNumQueries(ADMIN_ANNOUNCEMENT_LIST_QUERY_BUDGET):
            response = self.client.get(reverse('site-admin-announcements'))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data['results']), 8)

    def test_admin_detail_query_count_is_flat_across_revision_history(self):
        announcement = create_announcement(
            actor=self.admin,
            internal_name='Lịch sử revision',
            revision_data=revision_payload(),
        )
        for number in range(2, 7):
            announcement, _ = create_announcement_revision(
                announcement=announcement,
                actor=self.admin,
                revision_data=revision_payload(message_vi=f'Revision {number}'),
                expected_revision_token=number - 1,
            )
        self.client.force_authenticate(self.admin)

        with self.assertNumQueries(ADMIN_ANNOUNCEMENT_DETAIL_QUERY_BUDGET):
            response = self.client.get(
                reverse(
                    'site-admin-announcement-detail',
                    kwargs={'public_id': announcement.public_id},
                )
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data['revisions']), 6)
        self.assertEqual(len(response.data['audit_events']), 6)

    def test_admin_metrics_query_count_is_flat_across_daily_rows(self):
        announcement = next(iter(admin_announcements_queryset()))
        self.client.force_authenticate(self.admin)

        with self.assertNumQueries(ADMIN_ANNOUNCEMENT_METRIC_QUERY_BUDGET):
            response = self.client.get(
                reverse(
                    'site-admin-announcement-metrics',
                    kwargs={'public_id': announcement.public_id},
                )
            )

        self.assertEqual(response.status_code, 200)
