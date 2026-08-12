from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from threading import Barrier

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.db import close_old_connections
from django.test import TestCase, TransactionTestCase
from django.utils import timezone

from apps.employers.models import Company
from apps.employers.tests.readiness_helpers import make_employer_ready
from apps.jobs.models import Job

from ..models import (
    JobServiceActivation,
    ServiceAuditEvent,
    ServiceCapability,
    ServiceCategory,
    ServiceEntitlementUnit,
    ServicePackage,
)
from ..services import (
    activate_job_service,
    add_package_version_item,
    create_package_version,
    expire_due_entitlement_units,
    expire_due_job_service_activations,
    grant_package_units,
    publish_package_version,
    revoke_entitlement_unit,
)


class EntitlementLedgerTests(TestCase):
    def setUp(self):
        user_model = get_user_model()
        self.admin = user_model.objects.create_user(
            email='services-admin@example.com',
            password='Password@123',
            role='admin',
        )
        self.employer = user_model.objects.create_user(
            email='services-employer@example.com',
            password='Password@123',
            role='employer',
        )
        self.company = Company.objects.create(
            company_name='Entitlement Co',
            created_by=self.employer,
        )
        make_employer_ready(self.employer, company=self.company)
        self.job = self.make_active_job()
        category = ServiceCategory.objects.create(key='commercial', name_vi='Thương mại')
        package = ServicePackage.objects.create(
            category=category,
            slug='priority-14-days',
            name_vi='Ưu tiên 14 ngày',
        )
        self.version = create_package_version(package=package, price=299000)
        add_package_version_item(
            package_version=self.version,
            capability=ServiceCapability.objects.get(code='sponsored_placement'),
            duration_days=14,
            configuration={'placement': 'search_sponsored'},
        )
        self.version = publish_package_version(
            package_version=self.version,
            actor=self.admin,
        )

    def make_active_job(self, *, company=None, employer=None, visibility_days=60):
        company = company or self.company
        employer = employer or self.employer
        now = timezone.now()
        return Job.objects.create(
            posted_by=employer,
            company=company,
            title='Backend Engineer',
            description='Xây dựng nền tảng tuyển dụng.',
            requirements='Có kinh nghiệm phát triển API.',
            benefits='Môi trường làm việc tốt.',
            status=Job.Status.ACTIVE,
            deadline=timezone.localdate() + timedelta(days=visibility_days),
            first_approved_at=now,
            visibility_starts_at=now,
            visibility_ends_at=now + timedelta(days=visibility_days),
            published_at=now,
            approved_at=now,
        )

    def grant_one(self, *, key='manual-payment-001', granted_at=None):
        return grant_package_units(
            company=self.company,
            package_version=self.version,
            quantity=1,
            actor=self.admin,
            grant_key=key,
            granted_at=granted_at,
        )[0]

    def test_grant_creates_independent_units_and_is_idempotent(self):
        granted_at = timezone.now()
        first_result = grant_package_units(
            company=self.company,
            package_version=self.version,
            quantity=3,
            actor=self.admin,
            grant_key='offline-receipt-100',
            granted_at=granted_at,
        )
        retry_result = grant_package_units(
            company=self.company,
            package_version=self.version,
            quantity=3,
            actor=self.admin,
            grant_key='offline-receipt-100',
            granted_at=granted_at,
        )

        self.assertEqual([unit.pk for unit in retry_result], [unit.pk for unit in first_result])
        self.assertEqual(ServiceEntitlementUnit.objects.count(), 3)
        self.assertEqual([unit.unit_number for unit in first_result], [1, 2, 3])
        self.assertEqual(first_result[0].activate_by, granted_at + timedelta(days=90))
        self.assertEqual(
            ServiceAuditEvent.objects.filter(event_type='unit_granted').count(),
            3,
        )

    def test_activation_on_last_allowed_instant_keeps_full_service_duration(self):
        granted_at = timezone.now() - timedelta(days=90)
        unit = self.grant_one(key='last-day', granted_at=granted_at)

        activation = activate_job_service(
            unit=unit,
            job=self.job,
            actor=self.employer,
            idempotency_key='activate-last-day',
            activated_at=unit.activate_by,
        )

        self.assertEqual(activation.starts_at, unit.activate_by)
        self.assertEqual(activation.ends_at, unit.activate_by + timedelta(days=14))
        self.assertGreater(activation.ends_at, unit.activate_by)
        unit.refresh_from_db()
        self.assertEqual(unit.status, ServiceEntitlementUnit.Status.CONSUMED)
        self.assertEqual(activation.items.get().remaining_quantity, 1)
        self.job.refresh_from_db()
        self.assertEqual(self.job.tier, Job.Tier.STANDARD)
        self.assertFalse(self.job.is_urgent)

    def test_activation_retry_returns_same_record(self):
        unit = self.grant_one()
        first = activate_job_service(
            unit=unit,
            job=self.job,
            actor=self.employer,
            idempotency_key='activation-retry',
        )
        second = activate_job_service(
            unit=unit,
            job=self.job,
            actor=self.employer,
            idempotency_key='activation-retry',
        )

        self.assertEqual(first.pk, second.pk)
        self.assertEqual(JobServiceActivation.objects.count(), 1)

    def test_insufficient_job_time_rolls_back_without_consuming_unit(self):
        short_job = self.make_active_job(visibility_days=10)
        unit = self.grant_one(key='short-job')

        with self.assertRaises(ValidationError):
            activate_job_service(
                unit=unit,
                job=short_job,
                actor=self.employer,
                idempotency_key='insufficient-time',
            )

        unit.refresh_from_db()
        self.assertEqual(unit.status, ServiceEntitlementUnit.Status.AVAILABLE)
        self.assertFalse(JobServiceActivation.objects.exists())
        self.assertFalse(ServiceAuditEvent.objects.filter(event_type='unit_consumed').exists())

    def test_cross_company_activation_is_rejected(self):
        other_employer = get_user_model().objects.create_user(
            email='other-company@example.com',
            password='Password@123',
            role='employer',
        )
        other_company = Company.objects.create(
            company_name='Other Co',
            created_by=other_employer,
        )
        make_employer_ready(other_employer, company=other_company)
        other_job = self.make_active_job(company=other_company, employer=other_employer)
        unit = self.grant_one(key='cross-company')

        with self.assertRaises(ValidationError):
            activate_job_service(
                unit=unit,
                job=other_job,
                actor=self.employer,
                idempotency_key='cross-company-activation',
            )

        unit.refresh_from_db()
        self.assertEqual(unit.status, ServiceEntitlementUnit.Status.AVAILABLE)

    def test_revoke_is_audited_and_history_is_append_only(self):
        unit = self.grant_one(key='revoke-unit')

        revoked = revoke_entitlement_unit(
            unit=unit,
            actor=self.admin,
            reason='Giao dịch ngoài hệ thống bị hủy.',
        )

        self.assertEqual(revoked.status, ServiceEntitlementUnit.Status.REVOKED)
        event = ServiceAuditEvent.objects.get(event_type='unit_revoked')
        self.assertEqual(event.metadata['reason'], 'Giao dịch ngoài hệ thống bị hủy.')
        event.metadata = {'reason': 'changed'}
        with self.assertRaises(ValidationError):
            event.save()
        with self.assertRaises(ValidationError):
            event.delete()

    def test_expiry_jobs_are_idempotent_and_audited(self):
        now = timezone.now()
        expired_unit = self.grant_one(
            key='expired-unit',
            granted_at=now - timedelta(days=91),
        )

        self.assertEqual(expire_due_entitlement_units(at=now), 1)
        self.assertEqual(expire_due_entitlement_units(at=now), 0)
        expired_unit.refresh_from_db()
        self.assertEqual(expired_unit.status, ServiceEntitlementUnit.Status.EXPIRED)
        self.assertEqual(expired_unit.expired_at, now)
        self.assertTrue(
            ServiceAuditEvent.objects.filter(
                event_type=ServiceAuditEvent.EventType.UNIT_EXPIRED,
                unit=expired_unit,
            ).exists()
        )

        active_unit = self.grant_one(key='activation-expiry')
        activation = activate_job_service(
            unit=active_unit,
            job=self.job,
            actor=self.employer,
            idempotency_key='activation-for-expiry',
        )
        self.assertEqual(
            expire_due_job_service_activations(at=activation.ends_at),
            1,
        )
        self.assertEqual(
            expire_due_job_service_activations(at=activation.ends_at),
            0,
        )
        activation.refresh_from_db()
        self.assertEqual(activation.status, JobServiceActivation.Status.EXPIRED)

    def test_expiry_task_is_registered_for_periodic_reconciliation(self):
        from django.conf import settings

        task_names = {entry['task'] for entry in settings.CELERY_BEAT_SCHEDULE.values()}
        self.assertIn(
            'apps.services.tasks.expire_service_inventory_and_activations',
            task_names,
        )


class ConcurrentEntitlementConsumptionTests(TransactionTestCase):
    reset_sequences = True

    def setUp(self):
        user_model = get_user_model()
        self.admin = user_model.objects.create_user(
            email='concurrency-admin@example.com',
            password='Password@123',
            role='admin',
        )
        self.employer = user_model.objects.create_user(
            email='concurrency-employer@example.com',
            password='Password@123',
            role='employer',
        )
        self.company = Company.objects.create(
            company_name='Concurrency Co',
            created_by=self.employer,
        )
        make_employer_ready(self.employer, company=self.company)
        now = timezone.now()
        self.job = Job.objects.create(
            posted_by=self.employer,
            company=self.company,
            title='Concurrency Engineer',
            description='Xây dựng hệ thống giao dịch.',
            requirements='Có kinh nghiệm PostgreSQL.',
            benefits='Môi trường tốt.',
            status=Job.Status.ACTIVE,
            deadline=timezone.localdate() + timedelta(days=60),
            first_approved_at=now,
            visibility_starts_at=now,
            visibility_ends_at=now + timedelta(days=60),
            published_at=now,
            approved_at=now,
        )
        category = ServiceCategory.objects.create(key='concurrency', name_vi='Concurrency')
        package = ServicePackage.objects.create(
            category=category,
            slug='concurrent-priority',
            name_vi='Ưu tiên concurrent',
        )
        version = create_package_version(package=package, price=299000)
        add_package_version_item(
            package_version=version,
            capability=ServiceCapability.objects.get(code='sponsored_placement'),
            duration_days=14,
            configuration={'placement': 'search_sponsored'},
        )
        version = publish_package_version(package_version=version, actor=self.admin)
        self.unit = grant_package_units(
            company=self.company,
            package_version=version,
            quantity=1,
            actor=self.admin,
            grant_key='concurrent-grant',
        )[0]

    def test_two_concurrent_requests_cannot_consume_one_unit_twice(self):
        barrier = Barrier(2)

        def consume(idempotency_key):
            close_old_connections()
            try:
                unit = ServiceEntitlementUnit.objects.get(pk=self.unit.pk)
                job = Job.objects.get(pk=self.job.pk)
                actor = get_user_model().objects.get(pk=self.employer.pk)
                barrier.wait(timeout=5)
                activation = activate_job_service(
                    unit=unit,
                    job=job,
                    actor=actor,
                    idempotency_key=idempotency_key,
                )
                return ('created', activation.pk)
            except ValidationError:
                return ('rejected', None)
            finally:
                close_old_connections()

        with ThreadPoolExecutor(max_workers=2) as executor:
            results = list(executor.map(consume, ('concurrent-a', 'concurrent-b')))

        self.assertEqual(sorted(result[0] for result in results), ['created', 'rejected'])
        self.assertEqual(JobServiceActivation.objects.count(), 1)
        self.unit.refresh_from_db()
        self.assertEqual(self.unit.status, ServiceEntitlementUnit.Status.CONSUMED)
