from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from apps.jobs.models import JobCategory

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
