from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from threading import Barrier

from django.contrib.auth import get_user_model
from django.db import close_old_connections
from django.test import TestCase, TransactionTestCase
from django.utils import timezone

from apps.jobs.models import JobCategory

from ..models import RecruiterProfile, RecruitmentNeed
from ..services import (
    InitialRecruitmentNeedAlreadyExists,
    create_initial_recruitment_need,
)


def make_recruiter(email):
    user = get_user_model().objects.create_user(
        email=email,
        password='Password@123',
        role='employer',
        email_verified=True,
    )
    return RecruiterProfile.objects.create(
        user=user,
        registration_completed_at=timezone.now(),
    )


def recruitment_need_values(category):
    return {
        'position_category': category,
        'position_level': RecruitmentNeed.PositionLevel.EMPLOYEE,
        'target_date': timezone.localdate() + timedelta(days=30),
        'is_continuous': False,
        'headcount': 3,
        'budget_min': 5_000_000,
        'budget_max': 10_000_000,
        'budget_source': RecruitmentNeed.BudgetSource.COMPANY,
        'consultation_topics': [RecruitmentNeed.ConsultationTopic.SERVICE_PACKAGES],
    }


class InitialRecruitmentNeedServiceTests(TestCase):
    def test_repeated_command_creates_only_one_initial_need(self):
        recruiter = make_recruiter('need-service@example.com')
        category = JobCategory.objects.create(
            name='Service recruitment need',
            category_type=JobCategory.CategoryType.SPECIALIZATION,
        )
        values = recruitment_need_values(category)

        need = create_initial_recruitment_need(
            recruiter=recruiter,
            validated_data=values,
        )

        self.assertEqual(need.recruiter, recruiter)
        self.assertIsNotNone(need.completed_at)
        with self.assertRaises(InitialRecruitmentNeedAlreadyExists):
            create_initial_recruitment_need(
                recruiter=recruiter,
                validated_data=values,
            )
        self.assertEqual(RecruitmentNeed.objects.filter(recruiter=recruiter).count(), 1)


class InitialRecruitmentNeedConcurrencyTests(TransactionTestCase):
    def test_simultaneous_commands_create_only_one_initial_need(self):
        recruiter = make_recruiter('need-race@example.com')
        category = JobCategory.objects.create(
            name='Concurrent recruitment need',
            category_type=JobCategory.CategoryType.SPECIALIZATION,
        )
        gate = Barrier(2)

        def create_once():
            close_old_connections()
            try:
                thread_recruiter = RecruiterProfile.objects.get(pk=recruiter.pk)
                thread_category = JobCategory.objects.get(pk=category.pk)
                gate.wait(timeout=5)
                try:
                    create_initial_recruitment_need(
                        recruiter=thread_recruiter,
                        validated_data=recruitment_need_values(thread_category),
                    )
                except InitialRecruitmentNeedAlreadyExists:
                    return 'duplicate'
                return 'created'
            finally:
                close_old_connections()

        with ThreadPoolExecutor(max_workers=2) as pool:
            outcomes = list(pool.map(lambda _: create_once(), range(2)))

        self.assertCountEqual(outcomes, ['created', 'duplicate'])
        self.assertEqual(RecruitmentNeed.objects.filter(recruiter=recruiter).count(), 1)
