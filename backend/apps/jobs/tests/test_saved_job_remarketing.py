from datetime import timedelta

from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.employers.models import Company
from apps.employers.tests.readiness_helpers import make_employer_ready
from apps.services.models import (
    SavedJobRemarketingImpression,
    ServiceCapability,
    ServiceCategory,
    ServicePackage,
)
from apps.services.services import (
    activate_job_service,
    add_package_version_item,
    create_package_version,
    grant_package_units,
    publish_package_version,
)

from ..models import Job, SavedJob
from ..selectors import saved_job_remarketing_lane


class SavedJobRemarketingApiTests(APITestCase):
    def setUp(self):
        user_model = get_user_model()
        self.admin = user_model.objects.create_user(
            email='remarketing-admin@example.com', password='Password@123', role='admin'
        )
        self.employer = user_model.objects.create_user(
            email='remarketing-employer@example.com',
            password='Password@123',
            role='employer',
        )
        self.candidate = user_model.objects.create_user(
            email='remarketing-candidate@example.com',
            password='Password@123',
            role='candidate',
        )
        self.company = Company.objects.create(
            company_name='Remarketing Co', created_by=self.employer
        )
        make_employer_ready(self.employer, company=self.company)
        now = timezone.now()
        self.job = Job.objects.create(
            posted_by=self.employer,
            company=self.company,
            title='Backend Engineer',
            description='Xây dựng nền tảng.',
            requirements='Kinh nghiệm Django.',
            benefits='Môi trường tốt.',
            status=Job.Status.ACTIVE,
            deadline=timezone.localdate() + timedelta(days=30),
            first_approved_at=now,
            visibility_starts_at=now,
            visibility_ends_at=now + timedelta(days=30),
            published_at=now,
            approved_at=now,
        )
        SavedJob.objects.create(candidate=self.candidate, job=self.job)
        category = ServiceCategory.objects.create(key='remarketing', name_vi='Remarketing')
        package = ServicePackage.objects.create(
            category=category,
            slug='saved-remarketing-test',
            name_vi='Remarketing tin đã lưu',
        )
        version = create_package_version(package=package, price=299000)
        add_package_version_item(
            package_version=version,
            capability=ServiceCapability.objects.get(code='saved_remarketing'),
            duration_days=14,
        )
        version = publish_package_version(package_version=version, actor=self.admin)
        unit = grant_package_units(
            company=self.company,
            package_version=version,
            quantity=1,
            actor=self.admin,
            grant_key='remarketing-test-grant',
        )[0]
        self.activation = activate_job_service(
            unit=unit,
            job=self.job,
            actor=self.employer,
            idempotency_key='remarketing-test-activation',
        )
        self.client.force_authenticate(self.candidate)

    def grant_marketing_consent(self):
        return self.client.post(
            reverse('privacy-consent'),
            {'preferences': True, 'analytics': False, 'marketing': True},
            format='json',
        )

    def test_lane_requires_marketing_consent_and_discloses_paid_reason(self):
        disabled = self.client.get(reverse('saved-job-remarketing-lane'))
        self.assertEqual(disabled.data, {'status': 'disabled', 'results': []})

        with self.settings(SAVED_JOB_REMARKETING_ENABLED=True):
            no_consent = self.client.get(reverse('saved-job-remarketing-lane'))
            self.assertEqual(no_consent.data, {'status': 'consent_required', 'results': []})
            self.grant_marketing_consent()
            response = self.client.get(reverse('saved-job-remarketing-lane'))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        result = response.data['results'][0]
        self.assertEqual(result['public_id'], self.job.public_id)
        self.assertEqual(result['display_reason'], 'Bạn đã lưu tin này trước đây')
        self.assertTrue(result['presentation']['sponsored'])
        self.assertEqual(result['presentation']['placement'], 'saved_remarketing')

    def test_impression_is_idempotent_for_the_day_and_hides_the_job(self):
        self.grant_marketing_consent()
        payload = {
            'job_public_id': self.job.public_id,
            'activation_public_id': self.activation.public_id,
        }
        with self.settings(SAVED_JOB_REMARKETING_ENABLED=True):
            first = self.client.post(
                reverse('saved-job-remarketing-impression'), payload, format='json'
            )
            retry = self.client.post(
                reverse('saved-job-remarketing-impression'), payload, format='json'
            )
            lane = self.client.get(reverse('saved-job-remarketing-lane'))

        self.assertEqual(first.data, {'counted': True})
        self.assertEqual(retry.data, {'counted': False})
        self.assertEqual(SavedJobRemarketingImpression.objects.count(), 1)
        self.assertEqual(lane.data['results'], [])

    def test_unsave_stops_delivery_without_consuming_a_frequency_slot(self):
        self.grant_marketing_consent()
        SavedJob.objects.filter(candidate=self.candidate, job=self.job).delete()
        with self.settings(SAVED_JOB_REMARKETING_ENABLED=True):
            response = self.client.post(
                reverse('saved-job-remarketing-impression'),
                {
                    'job_public_id': self.job.public_id,
                    'activation_public_id': self.activation.public_id,
                },
                format='json',
            )
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertFalse(SavedJobRemarketingImpression.objects.exists())

    def test_lane_query_count_is_flat(self):
        with self.assertNumQueries(8):
            rows = saved_job_remarketing_lane(self.candidate)

        self.assertEqual([row['job'].pk for row in rows], [self.job.pk])
