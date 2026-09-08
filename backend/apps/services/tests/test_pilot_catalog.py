from django.core.management import call_command
from django.test import TestCase, override_settings
from django.urls import reverse

from ..models import ServiceCategory, ServicePackage, ServicePackageVersion


class PilotCatalogCommandTests(TestCase):
    def test_seed_is_idempotent_and_never_auto_publishes(self):
        legacy_category = ServiceCategory.objects.create(
            key='featured-jobs', name_vi='Tin tuyển dụng nổi bật'
        )
        ServicePackage.objects.create(
            category=legacy_category,
            slug='top-max',
            name_vi='TOP MAX',
        )
        call_command('seed_service_commercial_pilot')
        call_command('seed_service_commercial_pilot')

        expected = {
            'priority-14-days': 299000,
            'featured-14-days': 799000,
            'accelerate-28-days': 1690000,
            'urgent-label-7-days': 99000,
            'job-refresh-once': 49000,
            'saved-remarketing-14-days': 299000,
        }
        self.assertEqual(
            set(ServicePackage.objects.filter(slug__in=expected).values_list('slug', flat=True)),
            set(expected),
        )
        self.assertEqual(ServicePackageVersion.objects.count(), len(expected))
        self.assertFalse(
            ServicePackageVersion.objects.filter(
                status=ServicePackageVersion.Status.PUBLISHED
            ).exists()
        )
        self.assertFalse(ServicePackage.objects.filter(slug='top-max').exists())
        self.assertFalse(ServiceCategory.objects.filter(key='featured-jobs').exists())
        for slug, price in expected.items():
            version = ServicePackageVersion.objects.get(package__slug=slug)
            self.assertEqual(version.price, price)
            self.assertEqual(version.activate_within_days, 90)

    @override_settings(SERVICE_CATALOG_V2_ENABLED=True)
    def test_draft_pilot_packages_are_not_public(self):
        call_command('seed_service_commercial_pilot')

        response = self.client.get(reverse('services-packages'))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), [])
