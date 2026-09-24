from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.applications.models import Application
from apps.candidates.models import (
    CandidateConsent,
    CandidateDesiredSpecialization,
    CandidateJobPreference,
    CandidatePreferredProvince,
    CandidatePreferredSkill,
)
from apps.cvs.models import UserCv
from apps.cvs.services import create_initial_document
from apps.employers.models import Company
from apps.employers.tests.readiness_helpers import make_employer_ready
from apps.locations.models import Location
from apps.skills.models import Skill

from ..models import (
    CandidateHiddenJob,
    Job,
    JobCategory,
    JobCategoryAssignment,
    JobLocation,
    JobSkill,
    SavedJob,
)
from ..selectors.recommendations import recommend_new_jobs_for_candidate_email


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
        make_employer_ready(self.employer, company=self.company, candidate_data=True)
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
        self.assertIn(
            'Phù hợp với tìm kiếm của bạn',
            response.data['results'][0]['match_reasons'],
        )
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
        self.assertIn('Phù hợp với kỹ năng của bạn', platform_job['match_reasons'])
        self.assertEqual(platform_job['match_score'], 24)

    def test_candidate_page_uses_only_preferences_with_explainable_pagination(self):
        response = self.client.get(
            reverse('candidate-job-recommendations'),
            {'page': 1, 'page_size': 1},
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['status'], 'ready')
        self.assertEqual(response.data['strategy'], 'candidate-preference-rule-v2')
        self.assertIsNone(response.data['source_cv'])
        self.assertEqual(
            response.data['sources'],
            {'job_preferences': True, 'cv': False, 'search_activity': False},
        )
        self.assertEqual(response.data['pagination']['page_size'], 1)
        self.assertEqual(response.data['results'][0]['title'], 'Fullstack Developer')
        self.assertIn(
            'Phù hợp với tìm kiếm của bạn',
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

    def test_candidate_page_never_exposes_or_uses_an_active_cv(self):
        self.cv.lifecycle_status = UserCv.LifecycleStatus.ARCHIVED
        self.cv.save(update_fields=['lifecycle_status', 'updated_at'])
        UserCv.objects.create(
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
        self.assertIsNone(response.data['source_cv'])
        self.assertFalse(response.data['sources']['cv'])

    def test_candidate_page_and_suitable_email_do_not_read_any_cv(self):
        from unittest.mock import patch

        with patch('apps.jobs.models.recommendation_queries._candidate_cvs') as candidate_cvs:
            page_response = self.client.get(reverse('candidate-job-recommendations'))
            email_payload = recommend_new_jobs_for_candidate_email(
                self.candidate,
                published_after=timezone.now() - timedelta(days=1),
                published_before=timezone.now() + timedelta(days=1),
            )

        self.assertEqual(page_response.status_code, 200, page_response.data)
        self.assertEqual(email_payload['status'], 'ready')
        candidate_cvs.assert_not_called()

    def test_candidate_page_matches_explicit_preferred_skills(self):
        skill_job = Job.objects.create(
            posted_by=self.employer,
            company=self.company,
            title='Kỹ sư nền tảng',
            description='Build a platform.',
            status=Job.Status.ACTIVE,
        )
        for index, skill_name in enumerate(['Python', 'Django', 'PostgreSQL', 'REST API']):
            skill = Skill.objects.create(name=skill_name)
            CandidatePreferredSkill.objects.create(
                job_preference=self.preference,
                skill=skill,
                sort_order=index,
            )
            JobSkill.objects.create(job=skill_job, skill=skill)

        response = self.client.get(reverse('candidate-job-recommendations'))

        self.assertEqual(response.status_code, 200, response.data)
        result = next(
            job for job in response.data['results'] if job['public_id'] == skill_job.public_id
        )
        self.assertEqual(result['match_score'], 24)
        self.assertEqual(result['match_reasons'], ['Phù hợp với kỹ năng của bạn'])

    def test_match_reasons_are_empty_when_only_weak_signals_reach_threshold(self):
        province = Location.objects.create(
            code='recommend-province',
            level=Location.Level.PROVINCE,
            name='Hà Nội',
        )
        ward = Location.objects.create(
            code='recommend-ward',
            level=Location.Level.WARD,
            name='Phường Cầu Giấy',
            parent=province,
        )
        CandidatePreferredProvince.objects.create(
            job_preference=self.preference,
            location=province,
        )
        weak_match = Job.objects.create(
            posted_by=self.employer,
            company=self.company,
            title='Công việc mới',
            description='General role.',
            status=Job.Status.ACTIVE,
            salary_type=Job.SalaryType.FIXED,
            salary_min=25_000_000,
            salary_max=25_000_000,
            experience_years=Job.ExperienceYears.THREE,
        )
        JobCategoryAssignment.objects.create(
            job=weak_match,
            category=self.specialization,
            role=JobCategoryAssignment.Role.PRIMARY_SPECIALIZATION,
        )
        JobLocation.objects.create(job=weak_match, location=ward)

        response = self.client.get(reverse('candidate-job-recommendations'))

        self.assertEqual(response.status_code, 200, response.data)
        result = next(
            job for job in response.data['results'] if job['public_id'] == weak_match.public_id
        )
        self.assertGreaterEqual(result['match_score'], 20)
        self.assertEqual(result['match_reasons'], [])

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
        self.assertIn(
            'Mức lương phù hợp',
            [detail['label'] for detail in from_result['match_details']],
        )

        self.preference.desired_salary_vnd = 20_000_000
        self.preference.save(update_fields=['desired_salary_vnd', 'updated_at'])
        up_to_response = self.client.get(reverse('candidate-job-recommendations'))
        up_to_result = next(
            job for job in up_to_response.data['results'] if job['public_id'] == up_to_job.public_id
        )
        self.assertIn(
            'Mức lương phù hợp',
            [detail['label'] for detail in up_to_result['match_details']],
        )

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


class PersonalizedRecommendationControlsApiTests(APITestCase):
    def setUp(self):
        self.candidate = get_user_model().objects.create_user(
            email='recommend-controls-candidate@example.com',
            password='password',
            role='candidate',
        )
        self.employer = get_user_model().objects.create_user(
            email='recommend-controls-employer@example.com',
            password='password',
            role='employer',
        )
        self.company = Company.objects.create(
            company_name='Recommendation Controls Co',
            created_by=self.employer,
        )
        make_employer_ready(self.employer, company=self.company, candidate_data=True)
        self.specialization = JobCategory.objects.create(
            name='Backend Developer',
            category_type=JobCategory.CategoryType.SPECIALIZATION,
        )
        profile = self.candidate.candidate_profile
        profile.job_preferences_configured = True
        profile.save(update_fields=['job_preferences_configured', 'updated_at'])
        self.preference = CandidateJobPreference.objects.create(
            candidate_profile=profile,
            desired_salary_vnd=25_000_000,
            experience_level=CandidateJobPreference.ExperienceLevel.THREE,
            willing_to_relocate=False,
        )
        CandidateDesiredSpecialization.objects.create(
            job_preference=self.preference,
            job_category=self.specialization,
        )
        CandidateConsent.objects.create(
            candidate_profile=profile,
            consent_type=CandidateConsent.ConsentType.AI_RECOMMENDATION,
            decision=CandidateConsent.Decision.GRANTED,
        )
        self.jobs = [self._create_matching_job(index) for index in range(6)]
        self.client.force_authenticate(self.candidate)

    def _create_matching_job(self, index):
        job = Job.objects.create(
            posted_by=self.employer,
            company=self.company,
            title=f'Backend Developer {index}',
            description='Build services.',
            status=Job.Status.ACTIVE,
        )
        JobCategoryAssignment.objects.create(
            job=job,
            category=self.specialization,
            role=JobCategoryAssignment.Role.PRIMARY_SPECIALIZATION,
        )
        return job

    def _inline_response_with_status(self, status, *, excluded=''):
        for index in range(200):
            params = {'page': 2, 'ranking_seed': f'inline-seed-{index}'}
            if excluded:
                params['excluded'] = excluded
            response = self.client.get(reverse('inline-job-recommendations'), params)
            self.assertEqual(response.status_code, 200, response.data)
            if response.data['status'] == status:
                return params, response
        self.fail(f'Không tìm được deterministic inline seed với status={status}.')

    def test_hide_is_idempotent_and_undo_is_owner_scoped(self):
        job = self.jobs[0]
        payload = {'job_public_id': job.public_id, 'source': 'matching'}

        first = self.client.post(reverse('hidden-job-create'), payload, format='json')
        second = self.client.post(reverse('hidden-job-create'), payload, format='json')

        self.assertEqual(first.status_code, 200, first.data)
        self.assertEqual(second.status_code, 200, second.data)
        self.assertEqual(first.data, {'hidden': True, 'job_public_id': job.public_id})
        hidden = CandidateHiddenJob.objects.get(candidate=self.candidate, job=job)
        self.assertEqual(hidden.source, CandidateHiddenJob.Source.MATCHING)
        self.assertEqual(CandidateHiddenJob.objects.filter(candidate=self.candidate).count(), 1)

        other = get_user_model().objects.create_user(
            email='recommend-controls-other@example.com',
            password='password',
            role='candidate',
        )
        CandidateHiddenJob.objects.create(candidate=other, job=job, source='homepage')
        undo_url = reverse('hidden-job-destroy', kwargs={'job_public_id': job.public_id})
        undo = self.client.delete(undo_url)
        repeated_undo = self.client.delete(undo_url)

        self.assertEqual(undo.status_code, 200, undo.data)
        self.assertEqual(repeated_undo.status_code, 200, repeated_undo.data)
        self.assertEqual(undo.data, {'hidden': False, 'job_public_id': job.public_id})
        self.assertFalse(
            CandidateHiddenJob.objects.filter(candidate=self.candidate, job=job).exists()
        )
        self.assertTrue(CandidateHiddenJob.objects.filter(candidate=other, job=job).exists())

    def test_hide_is_candidate_only(self):
        url = reverse('hidden-job-create')
        payload = {'job_public_id': self.jobs[0].public_id, 'source': 'inline'}
        employer = get_user_model().objects.create_user(
            email='recommend-controls-other-employer@example.com',
            password='password',
            role='employer',
        )
        self.client.force_authenticate(employer)
        forbidden = self.client.post(url, payload, format='json')
        self.client.force_authenticate(user=None)
        anonymous = self.client.post(url, payload, format='json')

        self.assertEqual(forbidden.status_code, 403)
        self.assertIn(anonymous.status_code, {401, 403})

    def test_hide_does_not_reveal_or_persist_non_public_jobs(self):
        draft = Job.objects.create(
            posted_by=self.employer,
            company=self.company,
            title='Backend Developer draft',
            description='Not public.',
            status=Job.Status.DRAFT,
        )

        response = self.client.post(
            reverse('hidden-job-create'),
            {'job_public_id': draft.public_id, 'source': 'matching'},
            format='json',
        )

        self.assertEqual(response.status_code, 404)
        self.assertFalse(CandidateHiddenJob.objects.filter(candidate=self.candidate).exists())

    def test_hidden_job_is_excluded_from_personalized_and_email_but_not_public_or_saved(self):
        job = self.jobs[0]
        now = timezone.now()
        job.published_at = now
        job.save(update_fields=['published_at', 'updated_at'])
        SavedJob.objects.create(candidate=self.candidate, job=job)
        self.client.post(
            reverse('hidden-job-create'),
            {'job_public_id': job.public_id, 'source': 'homepage'},
            format='json',
        )

        matching = self.client.get(reverse('candidate-job-recommendations'))
        email = recommend_new_jobs_for_candidate_email(
            self.candidate,
            published_after=now - timedelta(minutes=1),
            published_before=now + timedelta(minutes=1),
        )
        public = self.client.get(reverse('job-list'))
        saved = self.client.get(reverse('saved-job-list-create'))

        self.assertNotIn(job.public_id, [item['public_id'] for item in matching.data['results']])
        self.assertNotIn(job.public_id, [item['job'].public_id for item in email['results']])
        self.assertIn(job.public_id, [item['public_id'] for item in public.data['results']])
        self.assertIn(job.public_id, [item['job_detail']['public_id'] for item in saved.data])

        self.client.delete(reverse('hidden-job-destroy', kwargs={'job_public_id': job.public_id}))
        restored = self.client.get(reverse('candidate-job-recommendations'))
        self.assertIn(job.public_id, [item['public_id'] for item in restored.data['results']])

    def test_inline_lane_is_deterministic_and_filters_current_hidden_and_applied_jobs(self):
        hidden_job, applied_job, current_job = self.jobs[:3]
        self.client.post(
            reverse('hidden-job-create'),
            {'job_public_id': hidden_job.public_id, 'source': 'inline'},
            format='json',
        )
        cv = UserCv.objects.create(
            user=self.candidate,
            cv_type=UserCv.CvType.BUILDER,
            source=UserCv.Source.BUILDER,
            title='Application CV',
        )
        version = create_initial_document(cv, self.candidate)
        Application.objects.create(
            candidate=self.candidate,
            job=applied_job,
            cv=cv,
            submitted_cv_version=version,
            submitted_cv_title=cv.title,
            submitted_cv_source=cv.source,
        )
        params, first = self._inline_response_with_status(
            'ready',
            excluded=current_job.public_id,
        )
        second = self.client.get(reverse('inline-job-recommendations'), params)

        self.assertEqual(first.data, second.data)
        self.assertIn(len(first.data['results']), {1, 2})
        result_ids = [item['public_id'] for item in first.data['results']]
        self.assertEqual(len(result_ids), len(set(result_ids)))
        self.assertTrue(
            set(result_ids).isdisjoint(
                {hidden_job.public_id, applied_job.public_id, current_job.public_id}
            )
        )
        self.assertGreaterEqual(first.data['after_result_index'], 3)
        self.assertLessEqual(first.data['after_result_index'], 7)

    def test_inline_probability_gate_runs_before_ranking(self):
        from unittest.mock import patch

        params, _ = self._inline_response_with_status('not_shown')
        with patch('apps.jobs.models.recommendation_queries._rank_jobs') as rank_jobs:
            response = self.client.get(reverse('inline-job-recommendations'), params)

        self.assertEqual(response.data['status'], 'not_shown')
        self.assertEqual(response.data['results'], [])
        self.assertIsNone(response.data['after_result_index'])
        rank_jobs.assert_not_called()

    def test_inline_query_count_stays_flat_as_ranked_pool_grows(self):
        params, _ = self._inline_response_with_status('ready')
        self.client.get(reverse('inline-job-recommendations'), params)
        with CaptureQueriesContext(connection) as baseline_queries:
            baseline = self.client.get(reverse('inline-job-recommendations'), params)
        for index in range(6, 11):
            self._create_matching_job(index)
        with CaptureQueriesContext(connection) as expanded_queries:
            expanded = self.client.get(reverse('inline-job-recommendations'), params)

        self.assertEqual(baseline.status_code, 200, baseline.data)
        self.assertEqual(expanded.status_code, 200, expanded.data)
        self.assertEqual(len(expanded_queries), len(baseline_queries))

    def test_inline_requires_candidate_and_valid_seed(self):
        missing = self.client.get(reverse('inline-job-recommendations'), {'page': 1})
        invalid = self.client.get(
            reverse('inline-job-recommendations'),
            {'page': 1, 'ranking_seed': 'not valid'},
        )
        employer = get_user_model().objects.create_user(
            email='inline-other-employer@example.com',
            password='password',
            role='employer',
        )
        self.client.force_authenticate(employer)
        forbidden = self.client.get(
            reverse('inline-job-recommendations'),
            {'page': 1, 'ranking_seed': 'valid-seed'},
        )

        self.assertEqual(missing.status_code, 400)
        self.assertIn('ranking_seed', missing.data)
        self.assertEqual(invalid.status_code, 400)
        self.assertEqual(forbidden.status_code, 403)
