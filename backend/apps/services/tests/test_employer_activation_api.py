from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db import connection
from django.test import TestCase, override_settings
from django.test.utils import CaptureQueriesContext
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.employers.models import Company
from apps.employers.tests.readiness_helpers import make_employer_ready
from apps.jobs.models import Job

from ..models import ServiceCapability, ServiceCategory, ServicePackage
from ..services import (
    add_package_version_item,
    create_package_version,
    grant_package_units,
    publish_package_version,
)


@override_settings(SERVICE_ACTIVATION_ENABLED=True)
class EmployerActivationApiTests(TestCase):
    def setUp(self):
        user_model = get_user_model()
        self.admin = user_model.objects.create_user(
            email='activation-admin@example.com', password='Password@123', role='admin'
        )
        self.employer = user_model.objects.create_user(
            email='activation-employer@example.com', password='Password@123', role='employer'
        )
        self.company = Company.objects.create(
            company_name='Activation Co', created_by=self.employer
        )
        make_employer_ready(self.employer, company=self.company)
        now = timezone.now()
        self.job = Job.objects.create(
            posted_by=self.employer,
            company=self.company,
            title='Backend Engineer',
            description='Backend platform',
            requirements='PostgreSQL',
            benefits='Good team',
            status=Job.Status.ACTIVE,
            deadline=timezone.localdate() + timedelta(days=10),
            requested_visibility_days=10,
            first_approved_at=now,
            visibility_starts_at=now,
            visibility_ends_at=now + timedelta(days=10),
            published_at=now,
            approved_at=now,
        )
        category = ServiceCategory.objects.create(key='activation-api', name_vi='Activation')
        package = ServicePackage.objects.create(
            category=category, slug='activation-api-priority', name_vi='Ưu tiên'
        )
        version = create_package_version(package=package, price=299000)
        add_package_version_item(
            package_version=version,
            capability=ServiceCapability.objects.get(code='sponsored_placement'),
            duration_days=14,
            configuration={'placement': 'search_sponsored'},
        )
        add_package_version_item(
            package_version=version,
            capability=ServiceCapability.objects.get(code='job_refresh'),
            quantity=2,
            duration_days=14,
        )
        version = publish_package_version(package_version=version, actor=self.admin)
        self.unit = grant_package_units(
            company=self.company,
            package_version=version,
            quantity=1,
            actor=self.admin,
            grant_key='activation-api-grant',
        )[0]
        self.client = APIClient()
        self.client.force_authenticate(self.employer)

    def payload(self, **overrides):
        return {
            'unit_public_id': self.unit.public_id,
            'job_public_id': self.job.public_id,
            **overrides,
        }

    def test_inventory_preview_confirm_and_retry(self):
        inventory = self.client.get(reverse('services-employer-inventory'))
        self.assertEqual(inventory.status_code, status.HTTP_200_OK)
        self.assertEqual(inventory.data[0]['public_id'], self.unit.public_id)
        self.assertTrue(inventory.data[0]['is_activatable'])

        preview = self.client.post(
            reverse('services-employer-activation-preview'), self.payload(), format='json'
        )
        self.assertEqual(preview.status_code, status.HTTP_200_OK, preview.data)
        self.assertTrue(preview.data['deadline_extension_required'])

        missing_confirmation = self.client.post(
            reverse('services-employer-activation-create'),
            self.payload(),
            format='json',
            HTTP_IDEMPOTENCY_KEY='activation-api-key',
        )
        self.assertEqual(missing_confirmation.status_code, status.HTTP_400_BAD_REQUEST)

        created = self.client.post(
            reverse('services-employer-activation-create'),
            self.payload(confirm_extension=True),
            format='json',
            HTTP_IDEMPOTENCY_KEY='activation-api-key',
        )
        self.assertEqual(created.status_code, status.HTTP_201_CREATED, created.data)
        retry = self.client.post(
            reverse('services-employer-activation-create'),
            self.payload(confirm_extension=True),
            format='json',
            HTTP_IDEMPOTENCY_KEY='activation-api-key',
        )
        self.assertEqual(retry.status_code, status.HTTP_201_CREATED)
        self.assertEqual(retry.data['public_id'], created.data['public_id'])

    def test_inventory_query_count_stays_flat_as_units_grow(self):
        with CaptureQueriesContext(connection) as baseline_queries:
            baseline = self.client.get(reverse('services-employer-inventory'))
        self.assertEqual(baseline.status_code, status.HTTP_200_OK)

        grant_package_units(
            company=self.company,
            package_version=self.unit.package_version,
            quantity=20,
            actor=self.admin,
            grant_key='activation-api-expanded-grant',
        )
        with CaptureQueriesContext(connection) as expanded_queries:
            expanded = self.client.get(reverse('services-employer-inventory'))

        self.assertEqual(expanded.status_code, status.HTTP_200_OK)
        self.assertEqual(len(expanded.data), 21)
        self.assertEqual(len(expanded_queries), len(baseline_queries))
        self.assertLessEqual(len(expanded_queries), 8)

    @override_settings(JOB_PROMOTION_REFRESH_ENABLED=True)
    def test_active_services_and_refresh_are_scoped_idempotent_and_keep_recency(self):
        created = self.client.post(
            reverse('services-employer-activation-create'),
            self.payload(confirm_extension=True),
            format='json',
            HTTP_IDEMPOTENCY_KEY='activation-for-refresh',
        )
        self.assertEqual(created.status_code, status.HTTP_201_CREATED, created.data)
        published_at = self.job.published_at

        active = self.client.get(
            reverse('services-employer-active-services'),
            {'job_public_id': self.job.public_id},
        )
        self.assertEqual(active.status_code, status.HTTP_200_OK)
        self.assertEqual(active.data[0]['public_id'], created.data['public_id'])
        refresh_url = reverse(
            'services-employer-refresh',
            kwargs={'public_id': created.data['public_id']},
        )
        first = self.client.post(refresh_url, HTTP_IDEMPOTENCY_KEY='api-refresh-1')
        retry = self.client.post(refresh_url, HTTP_IDEMPOTENCY_KEY='api-refresh-1')

        self.assertEqual(first.status_code, status.HTTP_201_CREATED, first.data)
        self.assertEqual(first.data['public_id'], retry.data['public_id'])
        self.assertEqual(first.data['remaining_quantity'], 1)
        self.job.refresh_from_db()
        self.assertEqual(self.job.published_at, published_at)

    def test_refresh_endpoint_is_hidden_behind_its_own_kill_switch(self):
        created = self.client.post(
            reverse('services-employer-activation-create'),
            self.payload(confirm_extension=True),
            format='json',
            HTTP_IDEMPOTENCY_KEY='activation-hidden-refresh',
        )
        response = self.client.post(
            reverse(
                'services-employer-refresh',
                kwargs={'public_id': created.data['public_id']},
            ),
            HTTP_IDEMPOTENCY_KEY='hidden-refresh',
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    @override_settings(SERVICE_ACTIVATION_ENABLED=False)
    def test_activation_endpoints_are_hidden_while_kill_switch_is_off(self):
        inventory = self.client.get(reverse('services-employer-inventory'))
        preview = self.client.post(
            reverse('services-employer-activation-preview'), self.payload(), format='json'
        )

        self.assertEqual(inventory.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(preview.status_code, status.HTTP_404_NOT_FOUND)
