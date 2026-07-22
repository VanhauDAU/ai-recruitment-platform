from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from apps.applications.models import Application
from apps.cvs.models import UserCv
from apps.cvs.services import create_initial_document
from apps.jobs.models import Job, JobCategory

from ..models import Company, RecruiterProfile, RecruitmentCampaign


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
        self.owner_profile = RecruiterProfile.objects.create(user=self.owner, company=self.company)
        self.other_profile = RecruiterProfile.objects.create(user=self.other, company=self.company)
        self.category = JobCategory.objects.create(
            name='Software Engineer', category_type=JobCategory.CategoryType.SPECIALIZATION
        )
        self.client = APIClient()

    def payload(self, **overrides):
        data = {
            'name': 'Tuyển Backend quý 3',
            'position_category': self.category.pk,
            'position_level': 'employee',
            'headcount_target': 2,
            'target_date': str(timezone.localdate() + timedelta(days=30)),
            'is_continuous': False,
            'budget_source': 'company',
            'status': 'draft',
        }
        data.update(overrides)
        return data

    def test_campaigns_are_private_to_their_creator_even_with_the_same_company(self):
        foreign = RecruitmentCampaign.objects.create(
            owner=self.other_profile,
            company=self.company,
            name='Private campaign',
            position_category=self.category,
            position_level='employee',
            headcount_target=1,
            is_continuous=True,
            budget_source='company',
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
        self.assertIsNone(campaign.position_category)
        self.assertEqual(campaign.position_level, '')
        self.assertEqual(campaign.budget_source, 'company')
        self.assertEqual(campaign.status, RecruitmentCampaign.Status.ACTIVE)

    def test_campaign_creation_does_not_require_a_recruiter_profile_or_company(self):
        user_model = get_user_model()
        unconfigured_employer = user_model.objects.create_user(
            email='campaign-no-company@example.com', password='password', role='employer'
        )
        self.client.force_authenticate(unconfigured_employer)

        response = self.client.post(
            reverse('employer-campaign-list'), {'name': 'Chiến dịch khởi tạo'}, format='json'
        )

        self.assertEqual(response.status_code, 201, response.data)
        campaign = RecruitmentCampaign.objects.get(public_id=response.data['public_id'])
        self.assertIsNone(campaign.company)
        self.assertEqual(campaign.owner.user, unconfigured_employer)

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
        Job.objects.create(
            posted_by=self.owner,
            company=self.company,
            campaign=campaign,
            title='Frontend pending',
            description='Pending review.',
            status=Job.Status.PENDING,
        )
        Job.objects.create(
            posted_by=self.owner,
            company=self.company,
            campaign=campaign,
            title='Frontend expired',
            description='Expired role.',
            status=Job.Status.ACTIVE,
            deadline=timezone.localdate() - timedelta(days=1),
        )
        candidate = get_user_model().objects.create_user(
            email='campaign-candidate@example.com', password='password', role='candidate'
        )
        cv = UserCv.objects.create(user=candidate, title='Frontend CV')
        snapshot = create_initial_document(cv, candidate)
        Application.objects.create(
            candidate=candidate,
            job=active_job,
            cv=cv,
            submitted_cv_version=snapshot,
            submitted_cv_title=cv.title,
        )
        self.client.force_authenticate(self.owner)

        listed = self.client.get(reverse('employer-campaign-list'))
        needs_review = self.client.get(reverse('employer-campaign-list'), {'scope': 'needs_review'})
        pending_jobs = self.client.get(reverse('employer-campaign-list'), {'scope': 'pending_jobs'})
        report = self.client.get(
            reverse('employer-campaign-report', kwargs={'public_id': campaign.public_id})
        )

        item = listed.data['results'][0]
        self.assertEqual(item['job_count'], 3)
        self.assertEqual(item['active_job_count'], 1)
        self.assertEqual(item['pending_job_count'], 1)
        self.assertEqual(item['expired_job_count'], 1)
        self.assertEqual(item['application_count'], 1)
        self.assertEqual(item['unviewed_application_count'], 1)
        self.assertEqual(needs_review.data['count'], 1)
        self.assertEqual(pending_jobs.data['count'], 1)
        self.assertEqual(report.data['jobs']['total'], 3)
        self.assertEqual(report.data['jobs']['active'], 1)
        self.assertEqual(report.data['jobs']['expired'], 1)

    def test_campaign_status_uses_explicit_lifecycle_transitions(self):
        campaign = RecruitmentCampaign.objects.create(
            owner=self.owner_profile,
            company=self.company,
            name='Lifecycle campaign',
            status=RecruitmentCampaign.Status.ACTIVE,
        )
        self.client.force_authenticate(self.owner)
        url = reverse('employer-campaign-status', kwargs={'public_id': campaign.public_id})

        paused = self.client.post(url, {'status': 'paused'}, format='json')
        reopened = self.client.post(url, {'status': 'active'}, format='json')
        cancelled = self.client.post(url, {'status': 'cancelled'}, format='json')
        invalid = self.client.post(url, {'status': 'active'}, format='json')

        self.assertEqual(paused.status_code, 200, paused.data)
        self.assertEqual(reopened.status_code, 200, reopened.data)
        self.assertEqual(cancelled.status_code, 200, cancelled.data)
        self.assertEqual(invalid.status_code, 400, invalid.data)

    def test_campaign_list_query_count_stays_flat(self):
        RecruitmentCampaign.objects.create(
            owner=self.owner_profile,
            company=self.company,
            name='Query budget campaign',
            status=RecruitmentCampaign.Status.ACTIVE,
        )
        self.client.force_authenticate(self.owner)

        with self.assertNumQueries(2):
            response = self.client.get(reverse('employer-campaign-list'))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['count'], 1)
