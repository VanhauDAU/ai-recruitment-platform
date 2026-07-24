"""Query-count contracts for employer recruitment-need reads."""

from datetime import timedelta

from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.jobs.models import JobCategory

from ..models import RecruiterProfile, RecruitmentNeed

# Authentication is bypassed with force_authenticate: one recruiter lookup plus
# one recruitment-need SELECT. The count must remain flat as rows are added.
RECRUITMENT_NEED_READ_BUDGET = 2


class RecruitmentNeedQueryBudgetTests(APITestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            email='need-budget@example.com',
            password='Password@123',
            role='employer',
            email_verified=True,
        )
        self.recruiter = RecruiterProfile.objects.create(
            user=self.user,
            registration_completed_at=timezone.now(),
        )
        category = JobCategory.objects.create(
            name='Recruitment need budget',
            category_type=JobCategory.CategoryType.SPECIALIZATION,
        )
        for index in range(5):
            RecruitmentNeed.objects.create(
                recruiter=self.recruiter,
                position_category=category,
                position_level=RecruitmentNeed.PositionLevel.EMPLOYEE,
                target_date=timezone.localdate() + timedelta(days=30 + index),
                headcount=index + 1,
                budget_source=RecruitmentNeed.BudgetSource.COMPANY,
                completed_at=timezone.now(),
            )
        self.client.force_authenticate(self.user)

    def test_onboarding_need_query_count_stays_flat(self):
        with self.assertNumQueries(RECRUITMENT_NEED_READ_BUDGET):
            response = self.client.get(reverse('employer-consulting-need'))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['position_category_name'], 'Recruitment need budget')

    def test_recruitment_need_list_query_count_stays_flat(self):
        with self.assertNumQueries(RECRUITMENT_NEED_READ_BUDGET):
            response = self.client.get(reverse('employer-recruitment-needs'))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 5)
