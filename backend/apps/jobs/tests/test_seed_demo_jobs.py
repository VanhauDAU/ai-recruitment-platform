from io import StringIO

from django.core.cache import cache
from django.core.management import call_command
from django.test import TestCase
from django.urls import reverse

from apps.employers.models import Company
from apps.locations.models import Location

from ..models import Job


class SeedDemoJobsTests(TestCase):
    def test_seeded_companies_are_featured_and_indexable(self):
        cache.clear()
        province = Location.objects.create(
            code='01',
            level=Location.Level.PROVINCE,
            name='Thành phố Hà Nội',
        )
        Location.objects.create(
            code='00001',
            level=Location.Level.WARD,
            name='Phường Ba Đình',
            parent=province,
        )

        call_command('seed_demo_jobs', stdout=StringIO())

        hiring_company_ids = set(
            Job.publicly_available_queryset().values_list('company__public_id', flat=True)
        )
        featured = self.client.get(reverse('public-company-list'))
        sitemap = self.client.get(reverse('seo-sitemap-companies'))

        self.assertTrue(hiring_company_ids)
        self.assertSetEqual(
            {item['public_id'] for item in featured.data['results']},
            hiring_company_ids,
        )
        self.assertTrue(all(item['logo_url'] for item in featured.data['results']))
        self.assertEqual(Company.objects.count(), 8)
        for slug in Company.objects.values_list('slug', flat=True):
            self.assertContains(sitemap, f'/cong-ty/{slug}<')
