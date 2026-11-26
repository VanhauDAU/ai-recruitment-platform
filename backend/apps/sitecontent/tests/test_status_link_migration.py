from importlib import import_module

from django.apps import apps
from django.test import TestCase

from ..models import LinkGroup, LinkItem

migration = import_module('apps.sitecontent.migrations.0014_footer_status_page_link')


class FooterStatusLinkMigrationTests(TestCase):
    def setUp(self):
        self.group, _ = LinkGroup.objects.get_or_create(
            key=migration.GROUP_KEY,
            defaults={'title': 'Về ProCV', 'placement': LinkGroup.Placement.FOOTER_NAV},
        )
        LinkItem.objects.create(group=self.group, label='Liên hệ', url='', order=3)

    def test_appends_the_link_once_after_existing_items(self):
        migration.forwards(apps, None)
        migration.forwards(apps, None)

        link = LinkItem.objects.get(group=self.group, url=migration.URL)
        self.assertEqual(link.label, 'Trạng thái hệ thống')
        self.assertEqual(link.order, 4)

    def test_backwards_removes_only_that_link(self):
        migration.forwards(apps, None)
        migration.backwards(apps, None)

        self.assertFalse(LinkItem.objects.filter(url=migration.URL).exists())
        self.assertTrue(LinkItem.objects.filter(group=self.group, label='Liên hệ').exists())
