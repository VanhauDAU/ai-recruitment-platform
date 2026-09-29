from datetime import timedelta
from unittest.mock import patch
from zoneinfo import ZoneInfo

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from apps.applications.models import Application
from apps.cvs.models import UserCv
from apps.cvs.services import create_initial_document
from apps.jobs.models import Job, JobCategory, JobEngagementDaily
from apps.services.models import (
    JobServiceActivation,
    ServiceCategory,
    ServiceEntitlementUnit,
    ServicePackage,
    ServicePackageVersion,
)

from ..models import (
    CampaignActivity,
    Company,
    DpaStatus,
    EmployerVerificationCase,
    RecruiterProfile,
    RecruitmentCampaign,
)
from .readiness_helpers import make_employer_ready


class RecruitmentCampaignApiTests(TestCase):
    def setUp(self):
        user_model = get_user_model()
        self.owner = user_model.objects.create_user(
            email='campaign-owner@example.com', password='password', role='employer'
        )
        self.other = user_model.objects.create_user(
            email='campaign-other@example.com', password='password', role='employer'
        )
        self.company = Company.objects.create(company_name='Campaign Co', created_by=self.owner)
        self.owner_profile = make_employer_ready(
            self.owner,
            company=self.company,
            candidate_data=True,
        )
        self.other_profile = make_employer_ready(self.other, company=self.company)
        self.category = JobCategory.objects.create(
            name='Software Engineer', category_type=JobCategory.CategoryType.SPECIALIZATION
        )
        self.client = APIClient()

    def payload(self, **overrides):
        data = {'name': 'Tuyển Backend quý 3'}
        data.update(overrides)
        return data

    def test_campaigns_are_private_to_their_creator_even_with_the_same_company(self):
        foreign = RecruitmentCampaign.objects.create(
            owner=self.other_profile,
            company=self.company,
            name='Private campaign',
        )
        self.client.force_authenticate(self.owner)

        created = self.client.post(reverse('employer-campaign-list'), self.payload(), format='json')
        listed = self.client.get(reverse('employer-campaign-list'))
        foreign_detail = self.client.get(
            reverse('employer-campaign-detail', kwargs={'public_id': foreign.public_id})
        )

        self.assertEqual(created.status_code, 201, created.data)
        self.assertEqual(
            [item['public_id'] for item in listed.data['results']], [created.data['public_id']]
        )
        self.assertEqual(foreign_detail.status_code, 404)

    def test_campaign_can_be_created_from_its_name_only(self):
        self.client.force_authenticate(self.owner)

        response = self.client.post(
            reverse('employer-campaign-list'), {'name': 'Tuyển dụng Quý 3/2026'}, format='json'
        )

        self.assertEqual(response.status_code, 201, response.data)
        campaign = RecruitmentCampaign.objects.get(public_id=response.data['public_id'])
        self.assertEqual(campaign.status, RecruitmentCampaign.Status.ACTIVE)

    def test_campaign_api_rejects_job_specific_fields(self):
        self.client.force_authenticate(self.owner)

        response = self.client.post(
            reverse('employer-campaign-list'),
            self.payload(headcount_target=3),
            format='json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn('headcount_target', response.data)

    def test_campaign_creation_requires_a_ready_workspace(self):
        user_model = get_user_model()
        unconfigured_employer = user_model.objects.create_user(
            email='campaign-no-company@example.com', password='password', role='employer'
        )
        self.client.force_authenticate(unconfigured_employer)

        response = self.client.post(
            reverse('employer-campaign-list'), {'name': 'Chiến dịch khởi tạo'}, format='json'
        )

        self.assertEqual(response.status_code, 403, response.data)
        self.assertEqual(response.data['code'], 'EMPLOYER_WORKSPACE_BLOCKED')
        self.assertFalse(
            RecruitmentCampaign.objects.filter(owner__user=unconfigured_employer).exists()
        )

    def test_new_or_dpa_held_employer_cannot_read_campaign_workspace_directly(self):
        user_model = get_user_model()
        legacy_user = user_model.objects.create_user(
            email='campaign-legacy-reader@example.com',
            password='password',
            role='employer',
        )
        legacy_company = Company.objects.create(
            company_name='Campaign legacy company',
            created_by=legacy_user,
        )
        legacy_profile = RecruiterProfile.objects.create(
            user=legacy_user,
            company=legacy_company,
        )
        legacy_campaign = RecruitmentCampaign.objects.create(
            owner=legacy_profile,
            company=legacy_company,
            name='Legacy inaccessible campaign',
        )
        self.client.force_authenticate(legacy_user)
        urls = (
            reverse('employer-campaign-list'),
            reverse('employer-campaign-options'),
            reverse(
                'employer-campaign-detail',
                kwargs={'public_id': legacy_campaign.public_id},
            ),
            reverse(
                'employer-campaign-pause-impact',
                kwargs={'public_id': legacy_campaign.public_id},
            ),
            reverse(
                'employer-campaign-activities',
                kwargs={'public_id': legacy_campaign.public_id},
            ),
            reverse(
                'employer-campaign-report',
                kwargs={'public_id': legacy_campaign.public_id},
            ),
            reverse(
                'employer-campaign-job-performance',
                kwargs={'public_id': legacy_campaign.public_id},
            ),
        )
        for url in urls:
            with self.subTest(url=url, state='new'):
                response = self.client.get(url)
                self.assertEqual(response.status_code, 403, response.data)
                self.assertEqual(response.data['code'], 'EMPLOYER_WORKSPACE_BLOCKED')

        self.client.force_authenticate(self.owner)
        with patch(
            'apps.employers.models.readiness.current_dpa_status',
            return_value=DpaStatus.HOLD,
        ):
            response = self.client.get(reverse('employer-campaign-list'))
        self.assertEqual(response.status_code, 403, response.data)
        self.assertEqual(response.data['code'], 'EMPLOYER_WORKSPACE_BLOCKED')

    def test_nonapproved_verification_keeps_campaign_workspace_reads_available(self):
        verification_case = self.owner_profile.verification_case
        verification_case.status = EmployerVerificationCase.Status.CHANGES_REQUESTED
        verification_case.save(update_fields=['status', 'updated_at'])
        campaign = RecruitmentCampaign.objects.create(
            owner=self.owner_profile,
            company=self.company,
            name='Workspace survives verification changes request',
        )
        self.client.force_authenticate(self.owner)

        for url in (
            reverse('employer-campaign-list'),
            reverse('employer-campaign-options'),
            reverse('employer-campaign-detail', kwargs={'public_id': campaign.public_id}),
            reverse('employer-campaign-report', kwargs={'public_id': campaign.public_id}),
        ):
            with self.subTest(url=url):
                response = self.client.get(url)
                self.assertEqual(response.status_code, 200, response.data)

    def test_campaign_list_exposes_operational_counts_and_filters(self):
        campaign = RecruitmentCampaign.objects.create(
            owner=self.owner_profile,
            company=self.company,
            name='Frontend team',
            status=RecruitmentCampaign.Status.ACTIVE,
        )
        active_job = Job.objects.create(
            posted_by=self.owner,
            company=self.company,
            campaign=campaign,
            title='Frontend Engineer',
            description='Build product UI.',
            status=Job.Status.ACTIVE,
            deadline=timezone.localdate() + timedelta(days=10),
        )
        second_active_job = Job.objects.create(
            posted_by=self.owner,
            company=self.company,
            campaign=campaign,
            title='Frontend Engineer Senior',
            description='Build product UI.',
            status=Job.Status.ACTIVE,
            deadline=timezone.localdate() + timedelta(days=10),
        )
        pending_campaign = RecruitmentCampaign.objects.create(
            owner=self.owner_profile,
            company=self.company,
            name='Backend team',
            status=RecruitmentCampaign.Status.ACTIVE,
        )
        Job.objects.create(
            posted_by=self.owner,
            company=self.company,
            campaign=pending_campaign,
            title='Backend pending',
            description='Pending review.',
            status=Job.Status.PENDING,
        )
        candidate = get_user_model().objects.create_user(
            email='campaign-candidate@example.com',
            password='password',
            role='candidate',
            full_name='Nguyễn Minh Anh',
            avatar_url='users/avatars/campaign-candidate.png',
        )
        cv = UserCv.objects.create(user=candidate, title='Frontend CV')
        snapshot = create_initial_document(cv, candidate)
        first_application = Application.objects.create(
            candidate=candidate,
            job=active_job,
            cv=cv,
            submitted_cv_version=snapshot,
            submitted_cv_title=cv.title,
        )
        Application.objects.create(
            candidate=candidate,
            job=second_active_job,
            cv=cv,
            submitted_cv_version=snapshot,
            submitted_cv_title=cv.title,
        )
        Application.objects.create(
            candidate=candidate,
            job=active_job,
            cv=cv,
            submitted_cv_version=snapshot,
            submitted_cv_title='Frontend CV mới',
            status=Application.Status.VIEWED,
        )
        self.client.force_authenticate(self.owner)

        listed = self.client.get(reverse('employer-campaign-list'))
        needs_review = self.client.get(reverse('employer-campaign-list'), {'scope': 'needs_review'})
        pending_jobs = self.client.get(reverse('employer-campaign-list'), {'scope': 'pending_jobs'})
        report = self.client.get(
            reverse('employer-campaign-report', kwargs={'public_id': campaign.public_id})
        )

        item = next(
            item for item in listed.data['results'] if item['public_id'] == campaign.public_id
        )
        self.assertEqual(item['job_count'], 2)
        self.assertEqual(item['active_job_count'], 2)
        self.assertEqual(item['pending_job_count'], 0)
        self.assertEqual(item['expired_job_count'], 0)
        self.assertEqual(item['candidate_count'], 1)
        self.assertEqual(
            item['candidate_previews'],
            [
                {
                    'public_id': candidate.public_id,
                    'full_name': 'Nguyễn Minh Anh',
                    'avatar_url': 'http://testserver/media/users/avatars/campaign-candidate.png',
                }
            ],
        )
        self.assertEqual(item['application_submission_count'], 3)
        self.assertEqual(item['application_pair_count'], 2)
        self.assertEqual(item['application_count'], 3)
        self.assertEqual(item['unviewed_application_count'], 1)
        self.assertEqual(item['unviewed_count'], 1)
        self.assertEqual(needs_review.data['count'], 1)
        self.assertEqual(pending_jobs.data['count'], 1)
        self.assertEqual(report.data['jobs']['total'], 2)
        self.assertEqual(report.data['jobs']['active'], 2)
        self.assertEqual(report.data['jobs']['expired'], 0)
        self.assertEqual(report.data['candidate_count'], 1)
        self.assertEqual(report.data['application_submission_count'], 3)
        self.assertEqual(report.data['application_pair_count'], 2)
        self.assertEqual(report.data['unviewed_count'], 1)
        self.assertEqual(first_application.status, Application.Status.SUBMITTED)

    def test_campaign_status_uses_explicit_lifecycle_transitions(self):
        campaign = RecruitmentCampaign.objects.create(
            owner=self.owner_profile,
            company=self.company,
            name='Lifecycle campaign',
            status=RecruitmentCampaign.Status.ACTIVE,
        )
        job = Job.objects.create(
            posted_by=self.owner,
            company=self.company,
            campaign=campaign,
            title='Public campaign job',
            description='Visible while campaign is active.',
            status=Job.Status.ACTIVE,
            deadline=timezone.localdate() + timedelta(days=5),
        )
        expired_job = Job.objects.create(
            posted_by=self.owner,
            company=self.company,
            campaign=campaign,
            title='Expired campaign job',
            description='Must not become public after resume.',
            status=Job.Status.ACTIVE,
            deadline=timezone.localdate() - timedelta(days=1),
        )
        now = timezone.now()
        service_category = ServiceCategory.objects.create(
            key='campaign-pause-impact',
            name_vi='Dịch vụ tin tuyển dụng',
        )
        service_package = ServicePackage.objects.create(
            category=service_category,
            slug='campaign-pause-priority',
            name_vi='Tin ưu tiên 14 ngày',
        )
        package_version = ServicePackageVersion.objects.create(
            package=service_package,
            version_number=1,
            price=299000,
        )

        def create_activation(*, key, starts_at, ends_at):
            unit = ServiceEntitlementUnit.objects.create(
                company=self.company,
                package_version=package_version,
                status=ServiceEntitlementUnit.Status.CONSUMED,
                source=ServiceEntitlementUnit.Source.MANUAL_GRANT,
                grant_key=key,
                unit_number=1,
                snapshot={'package_name': service_package.name_vi},
                granted_at=now - timedelta(days=10),
                activate_by=now + timedelta(days=30),
                consumed_at=now,
                created_by=self.owner,
            )
            return JobServiceActivation.objects.create(
                unit=unit,
                company=self.company,
                job=job,
                idempotency_key=key,
                status=JobServiceActivation.Status.ACTIVE,
                starts_at=starts_at,
                ends_at=ends_at,
                snapshot={'package_name': service_package.name_vi},
                created_by=self.owner,
            )

        active_service = create_activation(
            key='campaign-pause-active',
            starts_at=now - timedelta(days=2),
            ends_at=now + timedelta(days=12),
        )
        not_started_service = create_activation(
            key='campaign-pause-future',
            starts_at=now + timedelta(days=1),
            ends_at=now + timedelta(days=15),
        )
        ended_service = create_activation(
            key='campaign-pause-ended',
            starts_at=now - timedelta(days=15),
            ends_at=now - timedelta(seconds=1),
        )
        activation_before_pause = (
            active_service.status,
            active_service.starts_at,
            active_service.ends_at,
            active_service.updated_at,
        )
        self.client.force_authenticate(self.owner)
        url = reverse('employer-campaign-status', kwargs={'public_id': campaign.public_id})

        impact = self.client.get(
            reverse('employer-campaign-pause-impact', kwargs={'public_id': campaign.public_id})
        )
        missing_code = self.client.post(url, {'status': 'paused'}, format='json')
        wrong_code = self.client.post(
            url,
            {'status': 'paused', 'confirmation_code': f'{campaign.public_id}-wrong'},
            format='json',
        )
        padded_code = self.client.post(
            url,
            {'status': 'paused', 'confirmation_code': f' {campaign.public_id} '},
            format='json',
        )
        paused = self.client.post(
            url,
            {'status': 'paused', 'confirmation_code': campaign.public_id},
            format='json',
        )
        hidden_detail = self.client.get(reverse('job-detail', kwargs={'slug': job.slug}))
        reopened = self.client.post(url, {'status': 'active'}, format='json')
        visible_detail = self.client.get(reverse('job-detail', kwargs={'slug': job.slug}))
        expired_detail = self.client.get(reverse('job-detail', kwargs={'slug': expired_job.slug}))
        cancelled = self.client.post(url, {'status': 'cancelled'}, format='json')
        invalid = self.client.post(url, {'status': 'active'}, format='json')
        activities = self.client.get(
            reverse('employer-campaign-activities', kwargs={'public_id': campaign.public_id})
        )

        self.assertEqual(impact.status_code, 200, impact.data)
        self.assertEqual(impact.data['active_public_job_count'], 1)
        self.assertEqual(len(impact.data['active_services']), 1)
        self.assertEqual(
            impact.data['active_services'][0],
            {
                'public_id': active_service.public_id,
                'job_public_id': job.public_id,
                'job_title': job.title,
                'package_name': service_package.name_vi,
                'ends_at': active_service.ends_at,
            },
        )
        returned_service_ids = {item['public_id'] for item in impact.data['active_services']}
        self.assertNotIn(not_started_service.public_id, returned_service_ids)
        self.assertNotIn(ended_service.public_id, returned_service_ids)
        self.assertEqual(missing_code.status_code, 400)
        self.assertEqual(wrong_code.status_code, 400)
        self.assertEqual(padded_code.status_code, 400)
        self.assertEqual(paused.status_code, 200, paused.data)
        self.assertEqual(hidden_detail.status_code, 404)
        self.assertEqual(reopened.status_code, 200, reopened.data)
        self.assertEqual(visible_detail.status_code, 200)
        self.assertEqual(expired_detail.status_code, 404)
        self.assertEqual(cancelled.status_code, 200, cancelled.data)
        self.assertEqual(invalid.status_code, 400, invalid.data)
        job.refresh_from_db()
        expired_job.refresh_from_db()
        active_service.refresh_from_db()
        self.assertEqual(job.status, Job.Status.ACTIVE)
        self.assertEqual(expired_job.status, Job.Status.ACTIVE)
        self.assertEqual(
            (
                active_service.status,
                active_service.starts_at,
                active_service.ends_at,
                active_service.updated_at,
            ),
            activation_before_pause,
        )
        event_types = [item['event_type'] for item in activities.data['results']]
        self.assertIn('campaign_paused', event_types)
        self.assertIn('campaign_resumed', event_types)

    def test_candidate_activity_is_redacted_when_candidate_access_is_blocked(self):
        campaign = RecruitmentCampaign.objects.create(
            owner=self.owner_profile,
            company=self.company,
            name='Redacted activity campaign',
        )
        candidate = get_user_model().objects.create_user(
            email='redacted-candidate@example.com',
            password='password',
            role='candidate',
            full_name='Tên ứng viên nhạy cảm',
        )
        CampaignActivity.objects.create(
            campaign=campaign,
            actor=candidate,
            group=CampaignActivity.Group.APPLICATION,
            event_type=CampaignActivity.EventType.APPLICATION_RECEIVED,
            subject_public_id='app-sensitive-deeplink',
            metadata={
                'candidate_name': candidate.full_name,
                'candidate_email': candidate.email,
                'application_deep_link': '/employer/applications/app-sensitive-deeplink',
                'job_title': 'Backend Engineer',
            },
            occurred_at=timezone.now(),
        )
        verification_case = self.owner_profile.verification_case
        verification_case.status = EmployerVerificationCase.Status.CHANGES_REQUESTED
        verification_case.save(update_fields=['status', 'updated_at'])
        self.client.force_authenticate(self.owner)

        response = self.client.get(
            reverse('employer-campaign-activities', kwargs={'public_id': campaign.public_id})
        )

        self.assertEqual(response.status_code, 200, response.data)
        activity = response.data['results'][0]
        self.assertEqual(activity['actor_name'], 'Người dùng')
        self.assertEqual(activity['subject_public_id'], '')
        self.assertNotIn('candidate_name', activity['metadata'])
        self.assertNotIn('candidate_email', activity['metadata'])
        self.assertNotIn('application_deep_link', activity['metadata'])
        self.assertEqual(activity['metadata']['job_title'], 'Backend Engineer')

    def test_campaign_can_only_update_its_name(self):
        campaign = RecruitmentCampaign.objects.create(
            owner=self.owner_profile,
            company=self.company,
            name='Campaign name',
        )
        self.client.force_authenticate(self.owner)
        url = reverse('employer-campaign-detail', kwargs={'public_id': campaign.public_id})

        updated = self.client.patch(
            url,
            {'name': 'Campaign renamed'},
            format='json',
        )
        rejected = self.client.patch(
            url,
            {'description': 'Đây là dữ liệu của nhu cầu tuyển dụng.'},
            format='json',
        )

        self.assertEqual(updated.status_code, 200, updated.data)
        self.assertEqual(updated.data['name'], 'Campaign renamed')
        self.assertNotIn('description', updated.data)
        self.assertNotIn('headcount_target', updated.data)
        self.assertNotIn('insight_completion', updated.data)
        self.assertEqual(updated.data['last_activity']['event_type'], 'campaign_updated')
        self.assertEqual(rejected.status_code, 400)
        self.assertIn('description', rejected.data)

    def test_job_performance_uses_period_daily_counters_and_application_rows(self):
        campaign = RecruitmentCampaign.objects.create(
            owner=self.owner_profile,
            company=self.company,
            name='Performance campaign',
            status=RecruitmentCampaign.Status.ACTIVE,
        )
        job = Job.objects.create(
            posted_by=self.owner,
            company=self.company,
            campaign=campaign,
            title='Data Engineer',
            description='Build data products.',
            status=Job.Status.ACTIVE,
        )
        second_job = Job.objects.create(
            posted_by=self.owner,
            company=self.company,
            campaign=campaign,
            title='Analytics Engineer',
            description='Build analytics products.',
            status=Job.Status.ACTIVE,
        )
        foreign_campaign = RecruitmentCampaign.objects.create(
            owner=self.owner_profile,
            company=self.company,
            name='Another performance campaign',
            status=RecruitmentCampaign.Status.ACTIVE,
        )
        foreign_job = Job.objects.create(
            posted_by=self.owner,
            company=self.company,
            campaign=foreign_campaign,
            title='Foreign campaign job',
            description='Must not be selectable from another campaign.',
            status=Job.Status.ACTIVE,
        )
        report_date = timezone.localdate(timezone=ZoneInfo('Asia/Ho_Chi_Minh'))
        JobEngagementDaily.objects.create(
            job=job,
            date=report_date,
            impression_count=100,
            view_count=20,
        )
        JobEngagementDaily.objects.create(
            job=second_job,
            date=report_date,
            impression_count=50,
            view_count=10,
        )
        candidate = get_user_model().objects.create_user(
            email='performance-candidate@example.com',
            password='password',
            role='candidate',
        )
        cv = UserCv.objects.create(user=candidate, title='Data CV')
        snapshot = create_initial_document(cv, candidate)
        for _ in range(5):
            Application.objects.create(
                candidate=candidate,
                job=job,
                cv=cv,
                submitted_cv_version=snapshot,
                submitted_cv_title=cv.title,
            )
        for _ in range(2):
            Application.objects.create(
                candidate=candidate,
                job=second_job,
                cv=cv,
                submitted_cv_version=snapshot,
                submitted_cv_title=cv.title,
            )
        historic_application = Application.objects.create(
            candidate=candidate,
            job=job,
            cv=cv,
            submitted_cv_version=snapshot,
            submitted_cv_title=cv.title,
        )
        Application.objects.filter(pk=historic_application.pk).update(
            applied_at=job.engagement_tracking_started_at - timedelta(minutes=1)
        )

        self.client.force_authenticate(self.owner)
        url = reverse(
            'employer-campaign-job-performance',
            kwargs={'public_id': campaign.public_id},
        )
        with self.assertNumQueries(5):
            response = self.client.get(url, {'days': 7})

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['range']['days'], 7)
        self.assertEqual(
            response.data['scope'],
            {
                'type': 'all_jobs',
                'job_public_id': None,
                'job_title': None,
                'included_job_count': 2,
                'total_job_count': 2,
            },
        )
        self.assertEqual(
            response.data['summary'],
            {
                'impressions': 150,
                'views': 30,
                'applications': 7,
                'view_rate': 20.0,
                'application_rate': 23.33,
            },
        )
        self.assertEqual(len(response.data['daily']), 7)
        self.assertTrue(response.data['daily'][-1]['available'])
        self.assertFalse(response.data['daily'][0]['available'])
        self.assertEqual(
            {item['public_id']: item['applications'] for item in response.data['jobs']},
            {job.public_id: 5, second_job.public_id: 2},
        )
        self.assertEqual(response.data['daily'][-1]['impressions'], 150)
        self.assertEqual(response.data['daily'][-1]['views'], 30)
        self.assertEqual(response.data['daily'][-1]['applications'], 7)

        with self.assertNumQueries(5):
            selected = self.client.get(url, {'days': 7, 'job': second_job.public_id})

        self.assertEqual(selected.status_code, 200, selected.data)
        self.assertEqual(
            selected.data['scope'],
            {
                'type': 'job',
                'job_public_id': second_job.public_id,
                'job_title': second_job.title,
                'included_job_count': 1,
                'total_job_count': 2,
            },
        )
        self.assertEqual(
            selected.data['summary'],
            {
                'impressions': 50,
                'views': 10,
                'applications': 2,
                'view_rate': 20.0,
                'application_rate': 20.0,
            },
        )
        self.assertEqual(len(selected.data['jobs']), 2)
        self.assertEqual(selected.data['daily'][-1]['impressions'], 50)
        self.assertEqual(selected.data['daily'][-1]['views'], 10)
        self.assertEqual(selected.data['daily'][-1]['applications'], 2)
        selected_job_result = next(
            item for item in selected.data['jobs'] if item['public_id'] == second_job.public_id
        )
        self.assertEqual(
            selected.data['data_available_from'],
            selected_job_result['data_available_from'],
        )

        wrong_campaign_job = self.client.get(url, {'job': foreign_job.public_id})
        self.assertEqual(wrong_campaign_job.status_code, 404)

        invalid_range = self.client.get(url, {'days': 14})
        self.assertEqual(invalid_range.status_code, 400)

        self.client.force_authenticate(self.other)
        foreign = self.client.get(url)
        self.assertEqual(foreign.status_code, 404)

    def test_campaign_list_query_count_stays_flat(self):
        RecruitmentCampaign.objects.create(
            owner=self.owner_profile,
            company=self.company,
            name='Query budget campaign',
            status=RecruitmentCampaign.Status.ACTIVE,
        )
        self.client.force_authenticate(self.owner)

        with self.assertNumQueries(4):
            response = self.client.get(reverse('employer-campaign-list'))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['count'], 1)
