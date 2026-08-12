from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models import AdminPermission, AdminRole, Department
from apps.accounts.services import assign_membership
from apps.employers.models import Company

from ..models import (
    ServiceAuditEvent,
    ServiceCategory,
    ServiceEntitlementUnit,
    ServicePackage,
    ServicePackageVersion,
)


class AdminCommercialApiTests(TestCase):
    def setUp(self):
        user_model = get_user_model()
        self.admin = user_model.objects.create_user(
            email='commercial-admin@example.com',
            password='Password@123',
            role='admin',
        )
        department = Department.objects.create(code='commercial-tests', name='Commercial tests')
        role = AdminRole.objects.create(
            department=department,
            code='manager',
            name='Manager',
        )
        for code in (
            'service_catalog.view',
            'service_catalog.draft.manage',
            'service_catalog.publish',
            'service_entitlement.view',
            'service_entitlement.manage',
            'service_audit.view',
        ):
            permission, _ = AdminPermission.objects.get_or_create(
                code=code,
                defaults={'module': code.split('.')[0], 'label': code},
            )
            role.permissions.add(permission)
        assign_membership(self.admin, role, actor=self.admin)
        self.client = APIClient()
        self.client.force_authenticate(self.admin)
        category = ServiceCategory.objects.create(key='commercial-api', name_vi='Commercial')
        self.package = ServicePackage.objects.create(
            category=category,
            slug='api-priority',
            name_vi='Ưu tiên API',
        )
        employer = user_model.objects.create_user(
            email='commercial-employer@example.com',
            password='Password@123',
            role='employer',
        )
        self.company = Company.objects.create(
            company_name='Commercial Company',
            created_by=employer,
        )

    def version_payload(self, **overrides):
        payload = {
            'package': self.package.pk,
            'price': 299000,
            'currency': 'VND',
            'activate_within_days': 90,
            'terms_vi': 'Kích hoạt trong 90 ngày.',
            'items': [
                {
                    'capability': 'sponsored_placement',
                    'quantity': 1,
                    'duration_days': 14,
                    'configuration': {'placement': 'search_sponsored'},
                }
            ],
        }
        payload.update(overrides)
        return payload

    def create_version(self):
        response = self.client.post(
            reverse('services-admin-package-versions'),
            self.version_payload(),
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        return response.data

    def test_capability_registry_and_version_publish_workflow(self):
        capabilities = self.client.get(reverse('services-admin-capabilities'))
        self.assertEqual(capabilities.status_code, status.HTTP_200_OK)
        codes = {item['code'] for item in capabilities.data}
        self.assertEqual(len(codes), 7)
        self.assertNotIn('hot_label', codes)
        self.assertNotIn('red_label', codes)

        draft = self.create_version()
        self.assertEqual(draft['status'], ServicePackageVersion.Status.DRAFT)
        self.assertEqual(draft['version_number'], 1)
        self.assertEqual(draft['items'][0]['duration_days'], 14)

        published = self.client.post(
            reverse('services-admin-package-version-publish', args=[draft['id']]),
            {},
            format='json',
        )
        self.assertEqual(published.status_code, status.HTTP_200_OK, published.data)
        self.assertEqual(published.data['status'], ServicePackageVersion.Status.PUBLISHED)
        self.assertTrue(ServiceAuditEvent.objects.filter(event_type='package_published').exists())

        immutable_update = self.client.put(
            reverse('services-admin-package-version-detail', args=[draft['id']]),
            self.version_payload(price=399000),
            format='json',
        )
        self.assertEqual(immutable_update.status_code, status.HTTP_400_BAD_REQUEST)

    def test_grant_retry_revoke_and_audit_are_consistent(self):
        draft = self.create_version()
        self.client.post(
            reverse('services-admin-package-version-publish', args=[draft['id']]),
            {},
            format='json',
        )
        grant_payload = {
            'company_public_id': self.company.public_id,
            'package_version': draft['id'],
            'quantity': 2,
            'grant_key': 'receipt-api-001',
            'source': 'manual_grant',
        }
        granted = self.client.post(
            reverse('services-admin-entitlements'),
            grant_payload,
            format='json',
        )
        self.assertEqual(granted.status_code, status.HTTP_201_CREATED, granted.data)
        self.assertEqual(len(granted.data), 2)

        retry = self.client.post(
            reverse('services-admin-entitlements'),
            grant_payload,
            format='json',
        )
        self.assertEqual(retry.status_code, status.HTTP_201_CREATED)
        self.assertEqual(
            [unit['public_id'] for unit in retry.data],
            [unit['public_id'] for unit in granted.data],
        )
        self.assertEqual(ServiceEntitlementUnit.objects.count(), 2)

        revoked = self.client.post(
            reverse(
                'services-admin-entitlement-revoke',
                args=[granted.data[0]['public_id']],
            ),
            {'reason': 'Hoàn tiền giao dịch ngoài hệ thống.'},
            format='json',
        )
        self.assertEqual(revoked.status_code, status.HTTP_200_OK, revoked.data)
        self.assertEqual(revoked.data['status'], ServiceEntitlementUnit.Status.REVOKED)

        inventory = self.client.get(
            reverse('services-admin-entitlements'),
            {'company_public_id': self.company.public_id},
        )
        self.assertEqual(inventory.status_code, status.HTTP_200_OK)
        self.assertEqual(inventory.data['count'], 2)

        audit = self.client.get(
            reverse('services-admin-audit'),
            {'company_public_id': self.company.public_id},
        )
        self.assertEqual(audit.status_code, status.HTTP_200_OK)
        event_types = {event['event_type'] for event in audit.data['results']}
        self.assertIn('unit_granted', event_types)
        self.assertIn('unit_revoked', event_types)

    def test_publish_and_grant_are_separate_permissions(self):
        limited = get_user_model().objects.create_user(
            email='commercial-limited@example.com',
            password='Password@123',
            role='admin',
        )
        department = Department.objects.create(code='commercial-limited', name='Limited')
        role = AdminRole.objects.create(department=department, code='staff', name='Staff')
        for code in ('service_catalog.view', 'service_catalog.draft.manage'):
            permission = AdminPermission.objects.get(code=code)
            role.permissions.add(permission)
        assign_membership(limited, role, actor=self.admin)
        self.client.force_authenticate(limited)

        draft = self.create_version()
        denied_publish = self.client.post(
            reverse('services-admin-package-version-publish', args=[draft['id']]),
            {},
            format='json',
        )
        denied_grant = self.client.post(
            reverse('services-admin-entitlements'),
            {
                'company_public_id': self.company.public_id,
                'package_version': draft['id'],
                'quantity': 1,
                'grant_key': 'denied',
            },
            format='json',
        )

        self.assertEqual(denied_publish.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(denied_grant.status_code, status.HTTP_403_FORBIDDEN)
