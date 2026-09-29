from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db import connection
from django.test import TestCase, override_settings
from django.test.utils import CaptureQueriesContext
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.employers.models import Company, RecruitmentCampaign
from apps.employers.tests.readiness_helpers import make_employer_ready
from apps.jobs.models import Job

from ..models import JobServiceActivation, ServiceCapability, ServiceCategory, ServicePackage
from ..services import (
    activate_job_service,
    add_package_version_item,
    create_package_version,
    grant_package_units,
    publish_package_version,
    terminate_job_service_activation,
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
        self.recruiter = make_employer_ready(self.employer, company=self.company)
        now = timezone.now()
        self.campaign = RecruitmentCampaign.objects.create(
            owner=self.recruiter,
            company=self.company,
            name='Activation campaign',
            target_date=timezone.localdate() + timedelta(days=30),
            status=RecruitmentCampaign.Status.ACTIVE,
        )
        self.job = Job.objects.create(
            posted_by=self.employer,
            company=self.company,
            campaign=self.campaign,
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

    def create_public_job(self, *, owner=None, campaign=None, title='Service job'):
        owner = owner or self.employer
        now = timezone.now()
        return Job.objects.create(
            posted_by=owner,
            company=self.company,
            campaign=campaign,
            title=title,
            description='Backend platform',
            requirements='PostgreSQL',
            benefits='Good team',
            status=Job.Status.ACTIVE,
            deadline=timezone.localdate() + timedelta(days=30),
            requested_visibility_days=30,
            first_approved_at=now,
            visibility_starts_at=now,
            visibility_ends_at=now + timedelta(days=30),
            published_at=now,
            approved_at=now,
        )

    def grant_and_activate(self, *, job, actor, key):
        unit = grant_package_units(
            company=self.company,
            package_version=self.unit.package_version,
            quantity=1,
            actor=self.admin,
            grant_key=f'{key}-grant',
        )[0]
        return activate_job_service(
            unit=unit,
            job=job,
            actor=actor,
            idempotency_key=f'{key}-activation',
        )

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
        self.assertTrue(preview.data['extension_required'])
        self.assertEqual(
            str(preview.data['current_application_deadline']),
            self.job.deadline.isoformat(),
        )
        original_deadline = self.job.deadline

        missing_confirmation = self.client.post(
            reverse('services-employer-activation-create'),
            self.payload(),
            format='json',
            HTTP_IDEMPOTENCY_KEY='activation-api-key',
        )
        self.assertEqual(missing_confirmation.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Hệ thống không tự gia hạn tin', str(missing_confirmation.data))
        self.job.refresh_from_db()
        self.unit.refresh_from_db()
        self.assertEqual(self.job.deadline, original_deadline)
        self.assertEqual(self.unit.status, self.unit.Status.AVAILABLE)

        created = self.client.post(
            reverse('services-employer-activation-create'),
            self.payload(confirm_extension=True),
            format='json',
            HTTP_IDEMPOTENCY_KEY='activation-api-key',
        )
        self.assertEqual(created.status_code, status.HTTP_201_CREATED, created.data)
        self.job.refresh_from_db()
        self.assertEqual(
            self.job.deadline.isoformat(),
            str(preview.data['required_application_deadline']),
        )
        retry = self.client.post(
            reverse('services-employer-activation-create'),
            self.payload(confirm_extension=True),
            format='json',
            HTTP_IDEMPOTENCY_KEY='activation-api-key',
        )
        self.assertEqual(retry.status_code, status.HTTP_201_CREATED)
        self.assertEqual(retry.data['public_id'], created.data['public_id'])

    def test_preview_and_confirm_reject_overlapping_duration_effects(self):
        job = self.create_public_job(title='Overlap guarded job')
        self.grant_and_activate(job=job, actor=self.employer, key='overlap-existing')

        preview = self.client.post(
            reverse('services-employer-activation-preview'),
            self.payload(job_public_id=job.public_id),
            format='json',
        )

        self.assertEqual(preview.status_code, status.HTTP_200_OK, preview.data)
        self.assertFalse(preview.data['can_activate'])
        self.assertEqual(preview.data['conflicts'][0]['capability'], 'sponsored_placement')
        self.assertIn('đang chạy trong gói', preview.data['blockers'][0])

        created = self.client.post(
            reverse('services-employer-activation-create'),
            self.payload(job_public_id=job.public_id),
            format='json',
            HTTP_IDEMPOTENCY_KEY='overlap-guarded-confirm',
        )
        self.assertEqual(created.status_code, status.HTTP_400_BAD_REQUEST)
        self.unit.refresh_from_db()
        self.assertEqual(self.unit.status, self.unit.Status.AVAILABLE)

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

    def test_active_and_history_are_owner_scoped_and_filter_by_campaign(self):
        own_activation = self.grant_and_activate(
            job=self.create_public_job(
                campaign=self.campaign,
                title='Owned service job',
            ),
            actor=self.employer,
            key='owned-scope',
        )
        expired_activation = self.grant_and_activate(
            job=self.create_public_job(title='Owned expired service job'),
            actor=self.employer,
            key='owned-expired-scope',
        )
        expired_activation.status = JobServiceActivation.Status.EXPIRED
        expired_activation.save(update_fields=['status', 'updated_at'])
        terminated_activation = self.grant_and_activate(
            job=self.create_public_job(title='Owned terminated service job'),
            actor=self.employer,
            key='owned-terminated-scope',
        )
        terminate_job_service_activation(
            activation=terminated_activation,
            actor=self.admin,
            reason='Kết thúc thử nghiệm.',
        )
        coworker = get_user_model().objects.create_user(
            email='activation-coworker@example.com',
            password='Password@123',
            role='employer',
        )
        coworker_profile = make_employer_ready(coworker, company=self.company)
        coworker_campaign = RecruitmentCampaign.objects.create(
            owner=coworker_profile,
            company=self.company,
            name='Coworker campaign',
            target_date=timezone.localdate() + timedelta(days=30),
            status=RecruitmentCampaign.Status.ACTIVE,
        )
        coworker_activation = self.grant_and_activate(
            job=self.create_public_job(
                owner=coworker,
                campaign=coworker_campaign,
                title='Coworker service job',
            ),
            actor=coworker,
            key='coworker-scope',
        )

        active = self.client.get(
            reverse('services-employer-active-services'),
            {'campaign_public_id': self.campaign.public_id},
        )
        foreign_campaign = self.client.get(
            reverse('services-employer-active-services'),
            {'campaign_public_id': coworker_campaign.public_id},
        )
        history = self.client.get(
            reverse('services-employer-activation-history'),
            {'status': JobServiceActivation.Status.ACTIVE, 'ordering': 'job_title'},
        )
        complete_history = self.client.get(reverse('services-employer-activation-history'))

        self.assertEqual(active.status_code, status.HTTP_200_OK)
        self.assertEqual([item['public_id'] for item in active.data], [own_activation.public_id])
        self.assertEqual(foreign_campaign.data, [])
        self.assertEqual(history.status_code, status.HTTP_200_OK)
        self.assertEqual(history.data['count'], 1)
        result = history.data['results'][0]
        self.assertEqual(result['public_id'], own_activation.public_id)
        self.assertNotEqual(result['public_id'], coworker_activation.public_id)
        self.assertEqual(result['job_status'], Job.Status.ACTIVE)
        self.assertEqual(result['campaign_public_id'], self.campaign.public_id)
        self.assertEqual(result['campaign_name'], self.campaign.name)
        self.assertIn('package_slug', result)
        self.assertIn('items', result)
        self.assertIn('metrics', result)
        self.assertIsNone(result['terminated_at'])
        self.assertEqual(complete_history.data['count'], 3)
        by_status = {item['status']: item for item in complete_history.data['results']}
        self.assertIn(JobServiceActivation.Status.EXPIRED, by_status)
        self.assertEqual(
            by_status[JobServiceActivation.Status.TERMINATED]['termination_reason'],
            'Kết thúc thử nghiệm.',
        )

        invalid = self.client.get(
            reverse('services-employer-activation-history'),
            {'status': 'unknown'},
        )
        self.assertEqual(invalid.status_code, status.HTTP_400_BAD_REQUEST)

    def test_reopening_campaign_does_not_restore_an_activation_that_expired_while_paused(self):
        activation = self.grant_and_activate(
            job=self.create_public_job(
                campaign=self.campaign,
                title='Service expired during pause',
            ),
            actor=self.employer,
            key='expired-during-campaign-pause',
        )
        type(activation).objects.filter(pk=activation.pk).update(
            starts_at=timezone.now() - timedelta(days=15),
            ends_at=timezone.now() - timedelta(days=1),
        )

        status_url = reverse(
            'employer-campaign-status',
            kwargs={'public_id': self.campaign.public_id},
        )
        paused = self.client.post(
            status_url,
            {
                'status': 'paused',
                'confirmation_code': self.campaign.public_id,
            },
            format='json',
        )
        reopened = self.client.post(status_url, {'status': 'active'}, format='json')
        active = self.client.get(
            reverse('services-employer-active-services'),
            {'campaign_public_id': self.campaign.public_id},
        )
        history = self.client.get(
            reverse('services-employer-activation-history'),
            {'job_public_id': activation.job.public_id},
        )

        self.assertEqual(paused.status_code, status.HTTP_200_OK, paused.data)
        self.assertEqual(reopened.status_code, status.HTTP_200_OK, reopened.data)
        self.assertEqual(active.status_code, status.HTTP_200_OK, active.data)
        self.assertEqual(active.data, [])
        self.assertEqual(history.status_code, status.HTTP_200_OK, history.data)
        self.assertEqual(history.data['count'], 1)
        self.assertEqual(history.data['results'][0]['status'], JobServiceActivation.Status.ACTIVE)
        self.assertFalse(history.data['results'][0]['is_effective'])

    @override_settings(JOB_PROMOTION_REFRESH_ENABLED=True)
    def test_cannot_activate_or_use_service_on_coworker_job(self):
        coworker = get_user_model().objects.create_user(
            email='activation-coworker-action@example.com',
            password='Password@123',
            role='employer',
        )
        make_employer_ready(coworker, company=self.company)
        coworker_job = self.create_public_job(owner=coworker, title='Coworker private job')

        preview = self.client.post(
            reverse('services-employer-activation-preview'),
            self.payload(job_public_id=coworker_job.public_id),
            format='json',
        )
        create = self.client.post(
            reverse('services-employer-activation-create'),
            self.payload(job_public_id=coworker_job.public_id),
            format='json',
            HTTP_IDEMPOTENCY_KEY='coworker-job-denied',
        )
        coworker_activation = self.grant_and_activate(
            job=coworker_job,
            actor=coworker,
            key='coworker-action',
        )
        replay = self.client.post(
            reverse('services-employer-activation-create'),
            {
                'unit_public_id': coworker_activation.unit.public_id,
                'job_public_id': coworker_job.public_id,
            },
            format='json',
            HTTP_IDEMPOTENCY_KEY='coworker-action-activation',
        )
        refresh = self.client.post(
            reverse(
                'services-employer-refresh',
                kwargs={'public_id': coworker_activation.public_id},
            ),
            HTTP_IDEMPOTENCY_KEY='coworker-refresh-denied',
        )

        self.assertEqual(preview.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(create.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(replay.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(refresh.status_code, status.HTTP_404_NOT_FOUND)

    def test_activation_history_query_count_stays_flat(self):
        self.grant_and_activate(
            job=self.create_public_job(title='History baseline job'),
            actor=self.employer,
            key='history-baseline',
        )
        url = reverse('services-employer-activation-history')
        with CaptureQueriesContext(connection) as baseline_queries:
            baseline = self.client.get(url)
        self.assertEqual(baseline.status_code, status.HTTP_200_OK)

        for index in range(10):
            self.grant_and_activate(
                job=self.create_public_job(title=f'History expanded job {index}'),
                actor=self.employer,
                key=f'history-expanded-{index}',
            )
        with CaptureQueriesContext(connection) as expanded_queries:
            expanded = self.client.get(url)

        self.assertEqual(expanded.status_code, status.HTTP_200_OK)
        self.assertEqual(expanded.data['count'], 11)
        self.assertEqual(len(expanded_queries), len(baseline_queries))

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
