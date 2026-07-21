from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APITestCase

from apps.cvs.models import UserCv
from apps.employers.models import Company

from ..models import Job, JobCategory, JobCategoryAssignment


class CvJobRecommendationApiTests(APITestCase):
    def setUp(self):
        self.candidate = get_user_model().objects.create_user(
            email='recommend-candidate@example.com',
            password='password',
            role='candidate',
        )
        employer = get_user_model().objects.create_user(
            email='recommend-employer@example.com',
            password='password',
            role='employer',
        )
        company = Company.objects.create(company_name='Recommendation Co', created_by=employer)
        self.specialization = JobCategory.objects.create(
            name='Fullstack Developer',
            category_type=JobCategory.CategoryType.SPECIALIZATION,
        )
        self.cv = UserCv.objects.create(
            user=self.candidate,
            cv_type=UserCv.CvType.BUILDER,
            source=UserCv.Source.BUILDER,
            title='CV Fullstack',
            position=self.specialization,
        )
        matching = Job.objects.create(
            posted_by=employer,
            company=company,
            title='Fullstack Developer',
            description='Build products.',
            status=Job.Status.ACTIVE,
        )
        JobCategoryAssignment.objects.create(
            job=matching,
            category=self.specialization,
            role=JobCategoryAssignment.Role.PRIMARY_SPECIALIZATION,
        )
        Job.objects.create(
            posted_by=employer,
            company=company,
            title='Kế toán tổng hợp',
            description='Accounting.',
            status=Job.Status.ACTIVE,
        )
        self.client.force_authenticate(self.candidate)

    def test_ranks_owned_cv_context_and_returns_explainable_related_positions(self):
        response = self.client.get(
            reverse('cv-job-recommendations', kwargs={'cv_public_id': self.cv.public_id})
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['strategy'], 'profile-rule-v2')
        self.assertEqual(response.data['minimum_match_score'], 20)
        self.assertEqual(response.data['results'][0]['title'], 'Fullstack Developer')
        self.assertIn('Đúng vị trí chuyên môn', response.data['results'][0]['match_reasons'])
        self.assertIn(
            {'code': 'category', 'label': 'Đúng vị trí chuyên môn', 'points': 38},
            response.data['results'][0]['match_details'],
        )
        self.assertNotIn('Kế toán tổng hợp', [job['title'] for job in response.data['results']])
        self.assertEqual(response.data['related_positions'][0]['label'], 'Fullstack Developer')

    def test_cannot_rank_another_candidates_cv(self):
        other = get_user_model().objects.create_user(
            email='other-candidate@example.com',
            password='password',
            role='candidate',
        )
        self.client.force_authenticate(other)

        response = self.client.get(
            reverse('cv-job-recommendations', kwargs={'cv_public_id': self.cv.public_id})
        )

        self.assertEqual(response.status_code, 404)

    def test_uses_descriptive_cv_title_as_fallback_but_excludes_unrelated_jobs(self):
        title_only_cv = UserCv.objects.create(
            user=self.candidate,
            cv_type=UserCv.CvType.BUILDER,
            source=UserCv.Source.BUILDER,
            title='CV Fullstack Developer',
        )

        response = self.client.get(
            reverse(
                'cv-job-recommendations',
                kwargs={'cv_public_id': title_only_cv.public_id},
            )
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['focus_keyword'], 'Fullstack Developer')
        self.assertEqual(
            [job['title'] for job in response.data['results']], ['Fullstack Developer']
        )
        self.assertEqual(response.data['results'][0]['match_score'], 24)
        self.assertEqual(
            response.data['related_positions'],
            [
                {'label': 'Fullstack Developer', 'search': 'Fullstack Developer'},
            ],
        )
