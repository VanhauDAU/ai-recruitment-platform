"""Query budgets for public site-content collections."""

from django.urls import reverse
from rest_framework.test import APITestCase

from apps.jobs.models import JobCategory
from apps.locations.models import Location

from ..models import LinkGroup, LinkItem

LINK_GROUP_LIST_QUERY_BUDGET = 4


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
