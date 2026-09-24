from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models import AdminPermission, AdminRole, Department
from apps.accounts.services import assign_membership
from apps.employers.models import Company, RecruitmentCampaign
from apps.employers.tests.readiness_helpers import make_employer_ready
from apps.jobs.models import Job

from ..models import (
    JobPromotionMetricDaily,
    JobServiceActivation,
    ServiceAuditEvent,
    ServiceCategory,
    ServiceEntitlementUnit,
    ServicePackage,
    ServicePackageVersion,
)
from ..services import activate_job_service, grant_package_units


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
        self.employer = employer
        self.recruiter = make_employer_ready(employer, company=self.company)

    def publish_version(self):
        draft = self.create_version()
        response = self.client.post(
            reverse('services-admin-package-version-publish', args=[draft['id']]),
            {},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        return ServicePackageVersion.objects.get(pk=draft['id'])

    def create_public_job(
        self, *, owner=None, company=None, campaign=None, title='Admin service job'
    ):
        owner = owner or self.employer
        company = company or self.company
        now = timezone.now()
        return Job.objects.create(
            posted_by=owner,
            company=company,
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

    def grant_and_activate(self, *, version, job, actor=None, company=None, key):
        company = company or self.company
        actor = actor or self.employer
        unit = grant_package_units(
            company=company,
            package_version=version,
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

    def test_admin_activation_list_is_filterable_and_returns_rich_contract(self):
        version = self.publish_version()
        campaign = RecruitmentCampaign.objects.create(
            owner=self.recruiter,
            company=self.company,
            name='Commercial campaign',
            target_date=timezone.localdate() + timedelta(days=30),
            status=RecruitmentCampaign.Status.ACTIVE,
        )
        activation = self.grant_and_activate(
            version=version,
            job=self.create_public_job(campaign=campaign, title='Filtered paid job'),
            key='admin-filtered',
        )
        other_employer = get_user_model().objects.create_user(
            email='commercial-other-employer@example.com',
            password='Password@123',
            role='employer',
        )
        other_company = Company.objects.create(
            company_name='Other Commercial Company',
            created_by=other_employer,
        )
        make_employer_ready(other_employer, company=other_company)
        self.grant_and_activate(
            version=version,
            job=self.create_public_job(
                owner=other_employer,
                company=other_company,
                title='Other paid job',
            ),
            actor=other_employer,
            company=other_company,
            key='admin-other-company',
        )

        response = self.client.get(
            reverse('services-admin-activations'),
            {
                'company_public_id': self.company.public_id,
                'campaign_public_id': campaign.public_id,
                'job_public_id': activation.job.public_id,
                'status': JobServiceActivation.Status.ACTIVE,
                'ordering': 'job_title',
            },
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 1)
        result = response.data['results'][0]
        self.assertEqual(result['public_id'], activation.public_id)
        self.assertEqual(result['company_public_id'], self.company.public_id)
        self.assertEqual(result['company_name'], self.company.company_name)
        self.assertEqual(result['job_status'], Job.Status.ACTIVE)
        self.assertEqual(result['campaign_public_id'], campaign.public_id)
        self.assertEqual(result['campaign_name'], campaign.name)
        self.assertEqual(result['package_slug'], self.package.slug)
        self.assertTrue(result['items'])
        self.assertEqual(result['metrics']['impressions'], 0)
        self.assertIsNone(result['terminated_at'])

        invalid = self.client.get(
            reverse('services-admin-activations'),
            {'ordering': 'secret'},
        )
        self.assertEqual(invalid.status_code, status.HTTP_400_BAD_REQUEST)

    def test_admin_activation_summary_scopes_counts_units_and_metrics(self):
        version = self.publish_version()
        job = self.create_public_job(title='Summary paid job')
        active = self.grant_and_activate(
            version=version,
            job=job,
            key='admin-summary-active',
        )
        expired = self.grant_and_activate(
            version=version,
            job=self.create_public_job(title='Summary expired job'),
            key='admin-summary-expired',
        )
        expired.status = JobServiceActivation.Status.EXPIRED
        expired.save(update_fields=['status', 'updated_at'])
        grant_package_units(
            company=self.company,
            package_version=version,
            quantity=1,
            actor=self.admin,
            grant_key='admin-summary-available',
        )
        JobPromotionMetricDaily.objects.create(
            activation=active,
            date=timezone.localdate(),
            impression_count=100,
            view_count=20,
            save_count=5,
            apply_count=2,
        )

        response = self.client.get(
            reverse('services-admin-activation-summary'),
            {'company_public_id': self.company.public_id},
        )
        job_scope = self.client.get(
            reverse('services-admin-activation-summary'),
            {'job_public_id': job.public_id},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response.data['activation_counts'],
            {'total': 2, 'active': 1, 'expired': 1, 'terminated': 0},
        )
        self.assertEqual(response.data['active_total'], 1)
        self.assertEqual(
            response.data['metrics'],
            {
                'available': True,
                'impressions': 100,
                'views': 20,
                'saves': 5,
                'applies': 2,
            },
        )
        self.assertEqual(response.data['unit_counts']['available'], 1)
        self.assertEqual(response.data['unit_counts']['consumed'], 2)
        self.assertEqual(job_scope.data['activation_counts']['total'], 1)
        self.assertEqual(job_scope.data['metrics']['impressions'], 100)

    def test_admin_can_terminate_active_service_with_audit_but_viewer_cannot(self):
        version = self.publish_version()
        activation = self.grant_and_activate(
            version=version,
            job=self.create_public_job(title='Terminate paid job'),
            key='admin-terminate',
        )
        terminate_url = reverse(
            'services-admin-activation-terminate',
            args=[activation.public_id],
        )

        response = self.client.post(
            terminate_url,
            {'reason': 'Dừng do sự cố phân phối.'},
            format='json',
        )
        retry = self.client.post(
            terminate_url,
            {'reason': 'Không được dừng lần hai.'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(response.data['status'], JobServiceActivation.Status.TERMINATED)
        self.assertEqual(response.data['termination_reason'], 'Dừng do sự cố phân phối.')
        self.assertIsNotNone(response.data['terminated_at'])
        self.assertEqual(retry.status_code, status.HTTP_400_BAD_REQUEST)
        audit = ServiceAuditEvent.objects.get(
            event_type=ServiceAuditEvent.EventType.ACTIVATION_TERMINATED,
            activation=activation,
        )
        self.assertEqual(audit.actor, self.admin)
        self.assertEqual(audit.metadata['reason'], 'Dừng do sự cố phân phối.')

        viewer = get_user_model().objects.create_user(
            email='commercial-activation-viewer@example.com',
            password='Password@123',
            role='admin',
        )
        department = Department.objects.create(code='activation-viewer', name='Activation viewer')
        role = AdminRole.objects.create(department=department, code='viewer', name='Viewer')
        role.permissions.add(AdminPermission.objects.get(code='service_entitlement.view'))
        assign_membership(viewer, role, actor=self.admin)
        second = self.grant_and_activate(
            version=version,
            job=self.create_public_job(title='Viewer denied paid job'),
            key='admin-viewer-denied',
        )
        self.client.force_authenticate(viewer)

        allowed_list = self.client.get(reverse('services-admin-activations'))
        allowed_summary = self.client.get(reverse('services-admin-activation-summary'))
        denied_terminate = self.client.post(
            reverse('services-admin-activation-terminate', args=[second.public_id]),
            {'reason': 'Không đủ quyền.'},
            format='json',
        )

        self.assertEqual(allowed_list.status_code, status.HTTP_200_OK)
        self.assertEqual(allowed_summary.status_code, status.HTTP_200_OK)
        self.assertEqual(denied_terminate.status_code, status.HTTP_403_FORBIDDEN)
