from io import StringIO

from django.core.management import call_command
from django.test import TestCase

from ..management.commands.seed_sitecontent import load_seed_data
from ..models import Banner, LinkGroup, LinkItem, SiteSetting


def _seed():
    output = StringIO()
    call_command('seed_sitecontent', stdout=output)
    return output.getvalue()


def _counts():
    return {
        model.__name__: model.objects.count()
        for model in (SiteSetting, LinkGroup, LinkItem, Banner)
    }


class SeedSitecontentCommandTests(TestCase):
    def test_every_seed_record_exists_and_a_second_run_creates_nothing(self):
        _seed()
        first_counts = _counts()

        output = _seed()

        self.assertEqual(_counts(), first_counts)
        self.assertNotIn('\n+ ', f'\n{output}')
        seeded_keys = {row['key'] for row in load_seed_data('settings')}
        self.assertEqual(
            set(SiteSetting.objects.filter(key__in=seeded_keys).values_list('key', flat=True)),
            seeded_keys,
        )
        self.assertEqual(
            set(LinkGroup.objects.values_list('key', flat=True)),
            {row['key'] for row in load_seed_data('link_groups')},
        )

    def test_rerun_restores_metadata_but_keeps_admin_values(self):
        _seed()
        SiteSetting.objects.filter(key='site_name').update(label='Đổi tay', value='Tên riêng')
        SiteSetting.objects.filter(key='brand_logo_url').update(value='/favicon.svg')
        about = LinkGroup.objects.get(key='footer-about')
        about.items.all().delete()
        LinkGroup.objects.filter(pk=about.pk).update(title='Tiêu đề cũ', order=9)

        _seed()

        site_name = SiteSetting.objects.get(key='site_name')
        self.assertEqual(site_name.label, 'Tên site')
        self.assertEqual(site_name.value, 'Tên riêng')
        self.assertEqual(
            SiteSetting.objects.get(key='brand_logo_url').value,
            '/images/logo/logo-full.webp',
        )
        about.refresh_from_db()
        self.assertEqual((about.title, about.order), ('Về ProCV', 1))
        # Manual links are seeded only when the group is created.
        self.assertFalse(about.items.exists())

    def test_settings_are_ordered_by_position_within_their_group(self):
        _seed()

        brand_keys = [row['key'] for row in load_seed_data('settings') if row['group'] == 'brand']
        ordered = list(
            SiteSetting.objects.filter(key__in=brand_keys)
            .order_by('order')
            .values_list('key', flat=True)
        )
        self.assertEqual(ordered, brand_keys)
