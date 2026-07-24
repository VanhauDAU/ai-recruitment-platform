from django.contrib.auth import get_user_model
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.urls import reverse
from rest_framework.test import APITestCase

from apps.applications.models import Application
from apps.candidates.models import (
    CandidateConsent,
    CandidateDesiredSpecialization,
    CandidateJobPreference,
)
from apps.cvs.models import UserCv
from apps.cvs.services import create_initial_document
from apps.employers.models import Company
from apps.skills.models import Skill

from ..models import Job, JobCategory, JobCategoryAssignment, JobSkill


class CvJobRecommendationApiTests(APITestCase):
    def setUp(self):
        self.candidate = get_user_model().objects.create_user(
            email='recommend-candidate@example.com',
            password='password',
            role='candidate',
        )
        self.employer = get_user_model().objects.create_user(
            email='recommend-employer@example.com',
            password='password',
            role='employer',
        )
        self.company = Company.objects.create(
            company_name='Recommendation Co',
            created_by=self.employer,
        )
        self.specialization = JobCategory.objects.create(
            name='Fullstack Developer',
            category_type=JobCategory.CategoryType.SPECIALIZATION,
        )
        self.profile = self.candidate.candidate_profile
        self.profile.job_preferences_configured = True
        self.profile.save(update_fields=['job_preferences_configured', 'updated_at'])
        self.preference = CandidateJobPreference.objects.create(
            candidate_profile=self.profile,
            desired_salary_vnd=25_000_000,
            experience_level=CandidateJobPreference.ExperienceLevel.THREE,
            willing_to_relocate=False,
        )
        CandidateDesiredSpecialization.objects.create(
            job_preference=self.preference,
            job_category=self.specialization,
        )
        CandidateConsent.objects.create(
            candidate_profile=self.profile,
            consent_type=CandidateConsent.ConsentType.AI_RECOMMENDATION,
            decision=CandidateConsent.Decision.GRANTED,
        )
        self.cv = UserCv.objects.create(
            user=self.candidate,
            cv_type=UserCv.CvType.BUILDER,
            source=UserCv.Source.BUILDER,
            title='CV Fullstack',
            position=self.specialization,
            is_default=True,
        )
        self.matching = Job.objects.create(
            posted_by=self.employer,
            company=self.company,
            title='Fullstack Developer',
            description='Build products.',
            status=Job.Status.ACTIVE,
        )
        JobCategoryAssignment.objects.create(
            job=self.matching,
            category=self.specialization,
            role=JobCategoryAssignment.Role.PRIMARY_SPECIALIZATION,
        )
        Job.objects.create(
            posted_by=self.employer,
            company=self.company,
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

    def test_title_prefilter_is_accent_insensitive(self):
        title_only_cv = UserCv.objects.create(
            user=self.candidate,
            cv_type=UserCv.CvType.BUILDER,
            source=UserCv.Source.BUILDER,
            title='CV Ke toan',
        )

        response = self.client.get(
            reverse(
                'cv-job-recommendations',
                kwargs={'cv_public_id': title_only_cv.public_id},
            )
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(
            [job['title'] for job in response.data['results']],
            ['Kế toán tổng hợp'],
        )

    def test_json_only_cv_skills_can_enter_the_prefilter_pool(self):
        skill_names = ['Python', 'Django', 'PostgreSQL', 'REST API']
        skill_job = Job.objects.create(
            posted_by=self.employer,
            company=self.company,
            title='Kỹ sư nền tảng',
            description='Build a platform.',
            status=Job.Status.ACTIVE,
        )
        for skill_name in skill_names:
            JobSkill.objects.create(
                job=skill_job,
                skill=Skill.objects.create(name=skill_name),
            )
        cv = UserCv.objects.create(
            user=self.candidate,
            cv_type=UserCv.CvType.BUILDER,
            source=UserCv.Source.BUILDER,
            title='Hồ sơ cá nhân',
            cv_data={
                'sections': [
                    {
                        'section_key': 'skills',
                        'items': [{'name': skill_name} for skill_name in skill_names],
                    }
                ]
            },
        )

        response = self.client.get(
            reverse('cv-job-recommendations', kwargs={'cv_public_id': cv.public_id})
        )

        self.assertEqual(response.status_code, 200, response.data)
        platform_job = next(
            job for job in response.data['results'] if job['public_id'] == skill_job.public_id
        )
        self.assertIn('Khớp 4 kỹ năng', platform_job['match_reasons'])
        self.assertEqual(platform_job['match_score'], 24)

    def test_candidate_page_uses_preferences_and_default_cv_with_explainable_pagination(self):
        response = self.client.get(
            reverse('candidate-job-recommendations'),
            {'page': 1, 'page_size': 1},
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['status'], 'ready')
        self.assertEqual(response.data['strategy'], 'candidate-profile-rule-v1')
        self.assertEqual(response.data['source_cv']['public_id'], self.cv.public_id)
        self.assertTrue(response.data['source_cv']['is_default'])
        self.assertEqual(
            response.data['sources'],
            {'job_preferences': True, 'cv': True, 'search_activity': False},
        )
        self.assertEqual(response.data['pagination']['page_size'], 1)
        self.assertEqual(response.data['results'][0]['title'], 'Fullstack Developer')
        self.assertIn(
            'Đúng vị trí chuyên môn',
            response.data['results'][0]['match_reasons'],
        )

    def test_candidate_page_falls_back_to_preferences_without_a_cv(self):
        self.cv.delete()

        response = self.client.get(reverse('candidate-job-recommendations'))

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['status'], 'ready')
        self.assertIsNone(response.data['source_cv'])
        self.assertFalse(response.data['sources']['cv'])
        self.assertEqual(response.data['results'][0]['title'], 'Fullstack Developer')

    def test_candidate_page_ignores_archived_and_failed_cvs(self):
        self.cv.lifecycle_status = UserCv.LifecycleStatus.ARCHIVED
        self.cv.save(update_fields=['lifecycle_status', 'updated_at'])
        usable_cv = UserCv.objects.create(
            user=self.candidate,
            cv_type=UserCv.CvType.BUILDER,
            source=UserCv.Source.BUILDER,
            title='CV dùng được',
            position=self.specialization,
        )
        UserCv.objects.create(
            user=self.candidate,
            cv_type=UserCv.CvType.UPLOADED,
            source=UserCv.Source.UPLOADED,
            title='CV tải lên bị lỗi',
            status=UserCv.Status.FAILED,
            processing_status=UserCv.ProcessingStatus.FAILED,
        )

        response = self.client.get(reverse('candidate-job-recommendations'))

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['source_cv']['public_id'], usable_cv.public_id)

    def test_candidate_page_scores_open_salary_ranges(self):
        from_job = Job.objects.create(
            posted_by=self.employer,
            company=self.company,
            title='Fullstack Developer từ 20 triệu',
            description='Build products.',
            status=Job.Status.ACTIVE,
            salary_type=Job.SalaryType.FROM,
            salary_min=20_000_000,
        )
        up_to_job = Job.objects.create(
            posted_by=self.employer,
            company=self.company,
            title='Fullstack Developer đến 30 triệu',
            description='Build products.',
            status=Job.Status.ACTIVE,
            salary_type=Job.SalaryType.UP_TO,
            salary_max=30_000_000,
        )
        for job in (from_job, up_to_job):
            JobCategoryAssignment.objects.create(
                job=job,
                category=self.specialization,
                role=JobCategoryAssignment.Role.PRIMARY_SPECIALIZATION,
            )

        self.preference.desired_salary_vnd = 30_000_000
        self.preference.save(update_fields=['desired_salary_vnd', 'updated_at'])
        from_response = self.client.get(reverse('candidate-job-recommendations'))
        from_result = next(
            job for job in from_response.data['results'] if job['public_id'] == from_job.public_id
        )
        self.assertIn('Mức lương phù hợp', from_result['match_reasons'])

        self.preference.desired_salary_vnd = 20_000_000
        self.preference.save(update_fields=['desired_salary_vnd', 'updated_at'])
        up_to_response = self.client.get(reverse('candidate-job-recommendations'))
        up_to_result = next(
            job for job in up_to_response.data['results'] if job['public_id'] == up_to_job.public_id
        )
        self.assertIn('Mức lương phù hợp', up_to_result['match_reasons'])

    def test_candidate_page_excludes_jobs_already_applied_to(self):
        version = create_initial_document(self.cv, self.candidate)
        Application.objects.create(
            candidate=self.candidate,
            job=self.matching,
            cv=self.cv,
            submitted_cv_version=version,
            submitted_cv_title=self.cv.title,
            submitted_cv_source=self.cv.source,
        )

        response = self.client.get(reverse('candidate-job-recommendations'))

        self.assertEqual(response.status_code, 200, response.data)
        self.assertNotIn(
            self.matching.public_id,
            [job['public_id'] for job in response.data['results']],
        )

    def test_candidate_page_requires_setup_before_ranking(self):
        self.profile.job_preferences_configured = False
        self.profile.save(update_fields=['job_preferences_configured', 'updated_at'])

        response = self.client.get(reverse('candidate-job-recommendations'))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['status'], 'preferences_required')
        self.assertTrue(response.data['needs_setup'])
        self.assertEqual(response.data['results'], [])

    def test_candidate_page_requires_consent_and_by_cv_endpoint_enforces_it(self):
        consent = CandidateConsent.objects.get(
            candidate_profile=self.profile,
            consent_type=CandidateConsent.ConsentType.AI_RECOMMENDATION,
        )
        consent.decision = CandidateConsent.Decision.DENIED
        consent.save(update_fields=['decision', 'updated_at'])

        page_response = self.client.get(reverse('candidate-job-recommendations'))
        cv_response = self.client.get(
            reverse('cv-job-recommendations', kwargs={'cv_public_id': self.cv.public_id})
        )

        self.assertEqual(page_response.status_code, 200)
        self.assertEqual(page_response.data['status'], 'consent_required')
        self.assertTrue(page_response.data['consent_required'])
        self.assertEqual(page_response.data['results'], [])
        self.assertEqual(cv_response.status_code, 403)

    def test_candidate_page_is_candidate_only(self):
        employer = get_user_model().objects.create_user(
            email='other-employer@example.com',
            password='password',
            role='employer',
        )
        self.client.force_authenticate(employer)

        response = self.client.get(reverse('candidate-job-recommendations'))

        self.assertEqual(response.status_code, 403)

    def test_candidate_page_query_count_stays_flat_as_results_grow(self):
        """Guard the list endpoint against serializer or scoring N+1 regressions."""
        self.client.get(reverse('candidate-job-recommendations'))
        with CaptureQueriesContext(connection) as baseline_queries:
            baseline_response = self.client.get(reverse('candidate-job-recommendations'))
        for index in range(5):
            job = Job.objects.create(
                posted_by=self.employer,
                company=self.company,
                title=f'Fullstack Developer {index}',
                description='Build products.',
                status=Job.Status.ACTIVE,
            )
            JobCategoryAssignment.objects.create(
                job=job,
                category=self.specialization,
                role=JobCategoryAssignment.Role.PRIMARY_SPECIALIZATION,
            )
        with CaptureQueriesContext(connection) as expanded_queries:
            expanded_response = self.client.get(reverse('candidate-job-recommendations'))

        self.assertEqual(baseline_response.status_code, 200)
        self.assertEqual(expanded_response.status_code, 200)
        self.assertGreater(len(expanded_response.data['results']), 1)
        self.assertEqual(len(expanded_queries), len(baseline_queries))
