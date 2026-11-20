from datetime import timedelta
from unittest.mock import patch
from zoneinfo import ZoneInfo

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from apps.applications.models import Application
from apps.campaigns.models import CampaignActivity, RecruitmentCampaign
from apps.cvs.models import UserCv
from apps.cvs.services import create_initial_document
from apps.employers.models import Company, DpaStatus, EmployerVerificationCase, RecruiterProfile
from apps.employers.tests.factories import make_employer_ready
from apps.jobs.models import Job, JobCategory, JobEngagementDaily
from apps.jobs.tests.factories import open_visibility_window


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

    def test_quick_created_campaign_is_a_draft_unless_activated_inline(self):
        self.client.force_authenticate(self.owner)

        draft = self.client.post(
            reverse('employer-campaign-list'), {'name': 'Tuyển dụng Quý 3/2026'}, format='json'
        )
        inline = self.client.post(
            reverse('employer-campaign-list'),
            {'name': 'Tạo từ form đăng tin', 'activate': True},
            format='json',
        )

        self.assertEqual(draft.status_code, 201, draft.data)
        self.assertEqual(draft.data['status'], RecruitmentCampaign.Status.DRAFT)
        self.assertIsNone(draft.data['first_activated_at'])
        self.assertIsNone(draft.data['active_days'])
        self.assertEqual(inline.status_code, 201, inline.data)
        campaign = RecruitmentCampaign.objects.get(public_id=inline.data['public_id'])
        self.assertEqual(campaign.status, RecruitmentCampaign.Status.ACTIVE)
        self.assertIsNotNone(campaign.first_activated_at)
        self.assertEqual(campaign.activated_at, campaign.first_activated_at)

    def test_campaign_goal_fields_are_writable_and_validated(self):
        self.client.force_authenticate(self.owner)
        today = timezone.localdate()

        created = self.client.post(
            reverse('employer-campaign-list'),
            self.payload(
                description='Mở rộng đội backend',
                start_date=today.isoformat(),
                target_date=(today + timedelta(days=30)).isoformat(),
                budget_min=5_000_000,
                budget_max=10_000_000,
            ),
            format='json',
        )
        position_fields = self.client.post(
            reverse('employer-campaign-list'),
            self.payload(position_level='director'),
            format='json',
        )
        reversed_dates = self.client.post(
            reverse('employer-campaign-list'),
            self.payload(
                start_date=today.isoformat(),
                target_date=(today - timedelta(days=1)).isoformat(),
            ),
            format='json',
        )
        reversed_budget = self.client.post(
            reverse('employer-campaign-list'),
            self.payload(budget_min=10, budget_max=5),
            format='json',
        )

        self.assertEqual(created.status_code, 201, created.data)
        self.assertEqual(created.data['budget_max'], 10_000_000)
        self.assertEqual(created.data['headcount'], 0)
        # Position and level belong to each job, not to the campaign.
        self.assertNotIn('position_level', position_fields.data)
        self.assertEqual(reversed_dates.status_code, 400)
        self.assertIn('target_date', reversed_dates.data)
        self.assertEqual(reversed_budget.status_code, 400)
        self.assertIn('budget_max', reversed_budget.data)

    def test_campaign_list_orders_by_status_and_counts_each_status(self):
        for name, status in [
            ('Cancelled', RecruitmentCampaign.Status.CANCELLED),
            ('Draft', RecruitmentCampaign.Status.DRAFT),
            ('Running', RecruitmentCampaign.Status.ACTIVE),
            ('Completed', RecruitmentCampaign.Status.COMPLETED),
            ('Paused', RecruitmentCampaign.Status.PAUSED),
        ]:
            RecruitmentCampaign.objects.create(
                owner=self.owner_profile, company=self.company, name=name, status=status
            )
        self.client.force_authenticate(self.owner)

        listed = self.client.get(reverse('employer-campaign-list'), {'ordering': 'status'})
        ended = self.client.get(reverse('employer-campaign-list'), {'status': 'ended'})

        self.assertEqual(listed.status_code, 200, listed.data)
        self.assertEqual(
            [item['name'] for item in listed.data['results']],
            ['Running', 'Paused', 'Draft', 'Completed', 'Cancelled'],
        )
        self.assertEqual(
            listed.data['status_counts'],
            {
                'draft': 1,
                'scheduled': 0,
                'active': 1,
                'paused': 1,
                'completed': 1,
                'cancelled': 1,
                'ended': 2,
                'all': 5,
            },
        )
        self.assertEqual(
            sorted(item['name'] for item in ended.data['results']), ['Cancelled', 'Completed']
        )

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
            **open_visibility_window(),
        )
        second_active_job = Job.objects.create(
            posted_by=self.owner,
            company=self.company,
            campaign=campaign,
            title='Frontend Engineer Senior',
            description='Build product UI.',
            status=Job.Status.ACTIVE,
            deadline=timezone.localdate() + timedelta(days=10),
            **open_visibility_window(),
        )
        draft_campaign = RecruitmentCampaign.objects.create(
            owner=self.owner_profile,
            company=self.company,
            name='Backend team',
            status=RecruitmentCampaign.Status.ACTIVE,
        )
        Job.objects.create(
            posted_by=self.owner,
            company=self.company,
            campaign=draft_campaign,
            title='Backend draft',
            description='Not published yet.',
            status=Job.Status.DRAFT,
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
            is_current=False,
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
        report = self.client.get(
            reverse('employer-campaign-report', kwargs={'public_id': campaign.public_id})
        )

        item = next(
            item for item in listed.data['results'] if item['public_id'] == campaign.public_id
        )
        self.assertEqual(item['job_count'], 2)
        self.assertEqual(item['active_job_count'], 2)
        self.assertEqual(item['draft_job_count'], 0)
        self.assertNotIn('pending_job_count', item)
        self.assertNotIn('rejected_job_count', item)
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
            **open_visibility_window(),
        )
        expired_job = Job.objects.create(
            posted_by=self.owner,
            company=self.company,
            campaign=campaign,
            title='Expired campaign job',
            description='Must not become public after resume.',
            status=Job.Status.ACTIVE,
            deadline=timezone.localdate() - timedelta(days=1),
            **open_visibility_window(),
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
        draft = RecruitmentCampaign.objects.create(
            owner=self.owner_profile, company=self.company, name='Draft campaign'
        )
        direct_activation = self.client.post(
            reverse('employer-campaign-status', kwargs={'public_id': draft.public_id}),
            {'status': 'active'},
            format='json',
        )
        activities = self.client.get(
            reverse('employer-campaign-activities', kwargs={'public_id': campaign.public_id})
        )

        self.assertEqual(impact.status_code, 200, impact.data)
        self.assertEqual(impact.data['active_public_job_count'], 1)
        self.assertNotIn('active_services', impact.data)
        self.assertEqual(missing_code.status_code, 400)
        self.assertEqual(wrong_code.status_code, 400)
        self.assertEqual(padded_code.status_code, 400)
        self.assertEqual(paused.status_code, 200, paused.data)
        self.assertEqual(hidden_detail.status_code, 404)
        self.assertEqual(reopened.status_code, 200, reopened.data)
        self.assertEqual(visible_detail.status_code, 200)
        # A stopped job stays readable for application history, never applyable.
        self.assertEqual(expired_detail.status_code, 200)
        self.assertFalse(expired_detail.data['accepting_applications'])
        self.assertEqual(cancelled.status_code, 200, cancelled.data)
        self.assertEqual(invalid.status_code, 400, invalid.data)
        self.assertEqual(direct_activation.status_code, 400)
        self.assertEqual(direct_activation.data['code'], 'CAMPAIGN_LAUNCH_REQUIRED')
        job.refresh_from_db()
        expired_job.refresh_from_db()
        campaign.refresh_from_db()
        # Ending a campaign closes its jobs with history instead of hiding them.
        self.assertEqual(job.status, Job.Status.CLOSED)
        self.assertEqual(expired_job.status, Job.Status.CLOSED)
        self.assertEqual(job.status_history.order_by('-pk').first().to_status, Job.Status.CLOSED)
        self.assertEqual(campaign.ended_by, RecruitmentCampaign.EndedBy.USER)
        self.assertIsNotNone(campaign.ended_at)
        self.assertIsNotNone(campaign.first_activated_at)
        event_types = [item['event_type'] for item in activities.data['results']]
        self.assertIn('campaign_paused', event_types)
        self.assertIn('campaign_resumed', event_types)
        self.assertIn('campaign_cancelled', event_types)

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

    def test_campaign_goal_update_respects_running_and_ended_campaigns(self):
        today = timezone.localdate()
        campaign = RecruitmentCampaign.objects.create(
            owner=self.owner_profile,
            company=self.company,
            name='Campaign name',
            status=RecruitmentCampaign.Status.ACTIVE,
            start_date=today,
            target_date=today + timedelta(days=30),
        )
        Job.objects.create(
            posted_by=self.owner,
            company=self.company,
            campaign=campaign,
            title='Campaign job',
            description='Open',
            number_of_vacancies=4,
            status=Job.Status.ACTIVE,
            deadline=today + timedelta(days=20),
            **open_visibility_window(),
        )
        ended = RecruitmentCampaign.objects.create(
            owner=self.owner_profile,
            company=self.company,
            name='Ended',
            status=RecruitmentCampaign.Status.COMPLETED,
        )
        self.client.force_authenticate(self.owner)
        url = reverse('employer-campaign-detail', kwargs={'public_id': campaign.public_id})

        updated = self.client.patch(
            url, {'name': 'Campaign renamed', 'description': 'Mô tả mới'}, format='json'
        )
        moved_start = self.client.patch(
            url, {'start_date': (today + timedelta(days=1)).isoformat()}, format='json'
        )
        shortened = self.client.patch(
            url, {'target_date': (today + timedelta(days=10)).isoformat()}, format='json'
        )
        ended_edit = self.client.patch(
            reverse('employer-campaign-detail', kwargs={'public_id': ended.public_id}),
            {'name': 'Renamed after the end'},
            format='json',
        )

        self.assertEqual(updated.status_code, 200, updated.data)
        self.assertEqual(updated.data['name'], 'Campaign renamed')
        self.assertEqual(updated.data['description'], 'Mô tả mới')
        self.assertEqual(updated.data['headcount'], 4)
        self.assertEqual(updated.data['last_activity']['event_type'], 'campaign_updated')
        self.assertEqual(moved_start.status_code, 400)
        self.assertIn('start_date', moved_start.data)
        self.assertEqual(shortened.status_code, 400)
        self.assertIn('target_date', shortened.data)
        self.assertEqual(ended_edit.status_code, 400)

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
            **open_visibility_window(),
        )
        second_job = Job.objects.create(
            posted_by=self.owner,
            company=self.company,
            campaign=campaign,
            title='Analytics Engineer',
            description='Build analytics products.',
            status=Job.Status.ACTIVE,
            **open_visibility_window(),
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
            **open_visibility_window(),
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
        for index in range(5):
            Application.objects.create(
                candidate=candidate,
                job=job,
                cv=cv,
                submitted_cv_version=snapshot,
                submitted_cv_title=cv.title,
                is_current=index == 4,
            )
        for index in range(2):
            Application.objects.create(
                candidate=candidate,
                job=second_job,
                cv=cv,
                submitted_cv_version=snapshot,
                submitted_cv_title=cv.title,
                is_current=index == 1,
            )
        historic_application = Application.objects.create(
            candidate=candidate,
            job=job,
            cv=cv,
            submitted_cv_version=snapshot,
            submitted_cv_title=cv.title,
            is_current=False,
        )
        Application.objects.filter(pk=historic_application.pk).update(
            applied_at=job.engagement_tracking_started_at - timedelta(minutes=1)
        )

        self.client.force_authenticate(self.owner)
        url = reverse(
            'employer-campaign-job-performance',
            kwargs={'public_id': campaign.public_id},
        )
        # 4 + 1 middleware bảo trì đọc cấu hình (ADR-0026).
        with self.assertNumQueries(5 + 1):
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

        with self.assertNumQueries(5 + 1):
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

        # +1 fixed query for the status tab counts; +1 middleware bảo trì (ADR-0026).
        with self.assertNumQueries(5 + 1):
            response = self.client.get(reverse('employer-campaign-list'))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['count'], 1)
