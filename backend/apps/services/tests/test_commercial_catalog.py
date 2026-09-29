from decimal import Decimal

from django.core.exceptions import ValidationError
from django.test import TestCase

from ..models import (
    ServiceCapability,
    ServiceCategory,
    ServicePackage,
    ServicePackageVersion,
)
from ..services import (
    add_package_version_item,
    create_package_version,
    publish_package_version,
)


class CommercialCatalogTests(TestCase):
    def setUp(self):
        category = ServiceCategory.objects.create(key='job-services', name_vi='Dịch vụ tin')
        self.package = ServicePackage.objects.create(
            category=category,
            slug='priority',
            name_vi='Ưu tiên',
        )
        self.placement = ServiceCapability.objects.get(
            code=ServiceCapability.Code.SPONSORED_PLACEMENT
        )

    def make_version(self, *, price=299000, duration_days=14):
        version = create_package_version(package=self.package, price=price)
        add_package_version_item(
            package_version=version,
            capability=self.placement,
            duration_days=duration_days,
            configuration={'placement': 'search_sponsored'},
        )
        return version

    def test_capability_registry_excludes_non_commercial_badges(self):
        supported = set(ServiceCapability.Code.values)

        self.assertNotIn('hot_label', supported)
        self.assertNotIn('red_label', supported)
        self.assertNotIn('fast_response_badge', supported)
        self.assertNotIn('title_255', supported)

    def test_publish_requires_at_least_one_active_structured_capability(self):
        empty_version = create_package_version(package=self.package, price=299000)

        with self.assertRaises(ValidationError):
            publish_package_version(package_version=empty_version)

        empty_version.refresh_from_db()
        self.assertEqual(empty_version.status, ServicePackageVersion.Status.DRAFT)

        version = self.make_version()
        self.placement.is_active = False
        self.placement.save(update_fields=['is_active', 'updated_at'])
        with self.assertRaises(ValidationError):
            publish_package_version(package_version=version)

    def test_published_terms_and_items_are_immutable(self):
        version = publish_package_version(package_version=self.make_version())

        version.price = Decimal('399000')
        with self.assertRaises(ValidationError):
            version.save()

        item = version.items.get()
        item.duration_days = 28
        with self.assertRaises(ValidationError):
            item.save()
        with self.assertRaises(ValidationError):
            item.delete()
        with self.assertRaises(ValidationError):
            version.delete()

    def test_new_publication_archives_previous_version_without_mutating_snapshot(self):
        first = publish_package_version(package_version=self.make_version())
        second = self.make_version(price=799000, duration_days=28)

        published_second = publish_package_version(package_version=second)

        first.refresh_from_db()
        self.assertEqual(first.status, ServicePackageVersion.Status.ARCHIVED)
        self.assertEqual(first.price, Decimal('299000'))
        self.assertEqual(first.activate_within_days, 90)
        self.assertEqual(first.items.get().duration_days, 14)
        self.assertEqual(published_second.status, ServicePackageVersion.Status.PUBLISHED)
        self.assertEqual(published_second.version_number, 2)
        self.assertEqual(self.package.versions.filter(status='published').count(), 1)

    def test_activation_window_is_structured_per_version(self):
        version = create_package_version(
            package=self.package,
            price=99000,
            activate_within_days=120,
        )

        self.assertEqual(version.activate_within_days, 120)
        self.assertEqual(version.currency, 'VND')

    def test_capability_configuration_rejects_unknown_execution_values(self):
        tone = ServiceCapability.objects.get(code=ServiceCapability.Code.CARD_TONE)
        version = create_package_version(package=self.package, price=799000)

        with self.assertRaises(ValidationError):
            add_package_version_item(
                package_version=version,
                capability=tone,
                duration_days=14,
                configuration={'tone': 'arbitrary-css-class'},
            )

        original_scope = tone.scope
        tone.scope = ServiceCapability.Scope.COMPANY
        with self.assertRaises(ValidationError):
            tone.save()
        tone.refresh_from_db()
        self.assertEqual(tone.scope, original_scope)
