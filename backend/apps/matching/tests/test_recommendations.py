"""Gợi ý việc làm theo ngữ nghĩa (`semantic-v1`), kịch bản nghiệm thu TC-18…22 của kế hoạch bản 3."""

from datetime import timedelta
from unittest.mock import patch

from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.urls import reverse
from django.utils import timezone

from apps.applications.models import Application
from apps.candidates.models import (
    CandidateConsent,
    CandidateDesiredPositionOther,
    CandidateDesiredSpecialization,
    CandidateJobPreference,
)
from apps.jobs.models import CandidateHiddenJob, Job, JobCategory, JobCategoryAssignment, JobSkill
from apps.jobs.selectors.recommendation_intent import _experience_fits
from apps.jobs.tests.factories import open_visibility_window
from apps.sitecontent.models import SiteSetting
from apps.skills.models import Skill

from ..models import MatchDocument, jobs_for_profile
from ..services import SkillCatalog, ensure_cv_document, ensure_job_document, get_encoder
from .test_api import MatchingApiBase

FLAG = 'ai_job_recommendation_semantic_enabled'


class SemanticRecommendationTests(MatchingApiBase):
    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        accounting = Skill.objects.create(name='Kế toán thuế')
        cls.unrelated = Job.objects.create(
            posted_by=cls.employer,
            company=cls.job.company,
            title='Kế toán thuế',
            description='<ul><li>Lập tờ khai thuế giá trị gia tăng và quyết toán thuế thu nhập doanh nghiệp hằng quý.</li></ul>'
            * 4,
            requirements='<ul><li>Có chứng chỉ hành nghề kế toán và hiểu luật thuế.</li></ul>',
            status=Job.Status.ACTIVE,
            deadline=timezone.localdate() + timedelta(days=30),
            first_approved_at=timezone.now(),
            published_at=timezone.now(),
            **open_visibility_window(),
        )
        JobSkill.objects.create(job=cls.unrelated, skill=accounting)
        CandidateConsent.objects.create(
            candidate_profile=cls.candidate.candidate_profile,
            consent_type=CandidateConsent.ConsentType.AI_RECOMMENDATION,
            decision=CandidateConsent.Decision.GRANTED,
        )

    def setUp(self):
        super().setUp()
        SiteSetting.objects.update_or_create(key=FLAG, defaults={'value': True})
        encoder, catalog = get_encoder(), SkillCatalog.load()
        for job in jobs_for_profile():
            ensure_job_document(job, encoder=encoder)
        self.cv = self.candidate.cvs.get()
        ensure_cv_document(self.cv.latest_version, encoder=encoder, catalog=catalog)

    def recommendations(self):
        return self.client.get(reverse('candidate-job-recommendations'))

    def test_jobs_closest_to_the_cv_come_first_with_reasons_only(self):  # TC-18
        response = self.recommendations()

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual((body['status'], body['strategy']), ('ready', 'semantic-v1'))
        self.assertEqual(body['source_cv']['public_id'], self.cv.public_id)
        slugs = [job['slug'] for job in body['results']]
        self.assertEqual(slugs[0], self.job.slug)
        first = body['results'][0]
        self.assertIn('Trùng kỹ năng: ReactJS', first['match_reasons'])
        # Không có điểm thành phần để hiển thị: điểm duy nhất ứng viên thấy là của "Xem độ phù hợp".
        self.assertEqual(first['match_details'], [])

    def test_without_preferences_the_cv_is_enough(self):  # TC-18
        self.assertFalse(self.candidate.candidate_profile.job_preferences_configured)
        self.assertEqual(self.recommendations().json()['status'], 'ready')

    def test_cv_without_vector_falls_back_to_the_rule_recommender(self):  # TC-19
        MatchDocument.objects.filter(kind=MatchDocument.Kind.CV).delete()

        body = self.recommendations().json()

        self.assertEqual(body['strategy'], 'candidate-preference-rule-v2')
        self.assertEqual(body['status'], 'preferences_required')

    def test_no_job_close_enough_falls_back_to_the_rule_recommender(self):  # TC-19
        with patch('apps.jobs.selectors.recommendations.rank_jobs_for_cv', return_value=[]):
            body = self.recommendations().json()

        self.assertEqual(body['strategy'], 'candidate-preference-rule-v2')

    def test_no_ai_consent_means_no_semantic_ranking(self):  # TC-20
        CandidateConsent.objects.filter(candidate_profile=self.candidate.candidate_profile).update(
            decision=CandidateConsent.Decision.DENIED
        )

        body = self.recommendations().json()

        # Chưa khai nhu cầu và tắt AI: tin mới nhất, không đọc CV, không lý do.
        self.assertEqual(body['strategy'], 'latest-v1')
        self.assertFalse(body['ai_recommendation_enabled'])
        self.assertIsNone(body['source_cv'])
        slugs = [job['slug'] for job in body['results']]
        self.assertCountEqual(slugs, [self.job.slug, self.unrelated.slug])
        self.assertTrue(all(job['match_reasons'] == [] for job in body['results']))
        Application.objects.create(
            candidate=self.candidate,
            job=self.job,
            cv=self.cv,
            submitted_cv_version=self.cv.latest_version,
        )
        slugs = [job['slug'] for job in self.recommendations().json()['results']]
        self.assertEqual(slugs, [self.unrelated.slug])

    def test_applied_and_hidden_jobs_are_never_recommended(self):  # TC-21
        Application.objects.create(
            candidate=self.candidate,
            job=self.job,
            cv=self.cv,
            submitted_cv_version=self.cv.latest_version,
        )
        CandidateHiddenJob.objects.create(candidate=self.candidate, job=self.unrelated)

        slugs = [job['slug'] for job in self.recommendations().json()['results']]

        self.assertNotIn(self.job.slug, slugs)
        self.assertNotIn(self.unrelated.slug, slugs)

    def test_flag_off_uses_the_rule_recommender(self):  # TC-22
        SiteSetting.objects.filter(key=FLAG).update(value=False)

        self.assertEqual(self.recommendations().json()['strategy'], 'candidate-preference-rule-v2')

    def test_saved_cv_page_uses_the_same_ranking(self):
        response = self.client.get(reverse('cv-job-recommendations', args=[self.cv.public_id]))

        body = response.json()
        self.assertEqual(body['strategy'], 'semantic-v1')
        self.assertEqual(body['results'][0]['slug'], self.job.slug)
        # Không phải CV của mình: 404 như trước.
        other_cv = self.other.cvs.get()
        missing = self.client.get(reverse('cv-job-recommendations', args=[other_cv.public_id]))
        self.assertEqual(missing.status_code, 404)

    def test_query_count_does_not_grow_with_the_number_of_jobs(self):
        frontend = JobCategory.objects.create(
            name='Frontend Developer', category_type=JobCategory.CategoryType.SPECIALIZATION
        )
        CandidateDesiredSpecialization.objects.create(
            job_preference=self.preference(desired_salary_vnd=20_000_000), job_category=frontend
        )
        with CaptureQueriesContext(connection) as few:
            self.recommendations()
        for index in range(4):
            job = Job.objects.create(
                posted_by=self.employer,
                company=self.job.company,
                title=f'Frontend Developer {index}',
                description=self.job.description,
                requirements=self.job.requirements,
                status=Job.Status.ACTIVE,
                deadline=timezone.localdate() + timedelta(days=30),
                first_approved_at=timezone.now(),
                published_at=timezone.now(),
                **open_visibility_window(),
            )
            ensure_job_document(jobs_for_profile().get(pk=job.pk), encoder=get_encoder())
        with CaptureQueriesContext(connection) as many:
            body = self.recommendations().json()
        self.assertGreaterEqual(len(body['results']), 5)
        self.assertEqual(len(many), len(few))

    def preference(self, **fields):
        return CandidateJobPreference.objects.create(
            candidate_profile=self.candidate.candidate_profile, **fields
        )

    def result_for(self, job):
        body = self.recommendations().json()
        self.assertEqual(body['strategy'], 'semantic-v1')
        return next((item for item in body['results'] if item['slug'] == job.slug), None)

    def test_desired_position_brings_in_jobs_of_the_new_direction(self):
        # CV frontend, nhưng ứng viên khai muốn làm kế toán thuế: CV kể quá khứ, nhu cầu nói hướng đi.
        self.assertIsNone(self.result_for(self.unrelated))
        accounting = JobCategory.objects.create(
            name='Kế toán thuế', category_type=JobCategory.CategoryType.SPECIALIZATION
        )
        JobCategoryAssignment.objects.create(
            job=self.unrelated,
            category=accounting,
            role=JobCategoryAssignment.Role.PRIMARY_SPECIALIZATION,
        )
        CandidateDesiredSpecialization.objects.create(
            job_preference=self.preference(), job_category=accounting
        )

        result = self.result_for(self.unrelated)

        self.assertIsNotNone(result)
        self.assertEqual(result['match_reasons'][0], 'Đúng vị trí bạn mong muốn')

    def test_a_typed_position_matches_job_titles(self):
        CandidateDesiredPositionOther.objects.create(
            job_preference=self.preference(), name='kế toán thuế'
        )

        result = self.result_for(self.unrelated)

        self.assertEqual(result['match_reasons'][0], 'Đúng vị trí bạn mong muốn')

    def test_salary_and_experience_add_reasons_without_filtering(self):
        Job.objects.filter(pk=self.job.pk).update(
            salary_type=Job.SalaryType.RANGE,
            currency='VND',
            salary_min=15_000_000,
            salary_max=25_000_000,
        )
        self.preference(
            desired_salary_vnd=20_000_000,
            experience_level=CandidateJobPreference.ExperienceLevel.THREE,
        )
        reasons = self.result_for(self.job)['match_reasons']

        self.assertIn('Mức lương hợp mong muốn của bạn', reasons)
        self.assertIn('Số năm kinh nghiệm vừa với tin', reasons)
        CandidateJobPreference.objects.update(desired_salary_vnd=90_000_000)
        # Lương xa mức mong muốn: mất lý do, tin vẫn được gợi ý.
        self.assertNotIn(
            'Mức lương hợp mong muốn của bạn', self.result_for(self.job)['match_reasons']
        )

    def test_experience_bonus_only_for_a_close_band(self):
        self.assertTrue(_experience_fits('2', '3'))
        self.assertTrue(_experience_fits('none', 'under_1'))
        self.assertFalse(_experience_fits('none', 'over_5'))  # người 5+ năm và tin không yêu cầu
        self.assertFalse(_experience_fits('3', '1'))
        self.assertFalse(_experience_fits('2', ''))


class CurrentDocumentTests(MatchingApiBase):
    def test_editing_a_job_makes_only_the_new_document_current(self):
        encoder = get_encoder()
        first = ensure_job_document(jobs_for_profile().get(pk=self.job.pk), encoder=encoder)
        self.assertTrue(first.is_current)

        Job.objects.filter(pk=self.job.pk).update(
            requirements='<ul><li>Có 3 năm kinh nghiệm ReactJS và TypeScript.</li></ul>'
        )
        second = ensure_job_document(jobs_for_profile().get(pk=self.job.pk), encoder=encoder)
        first.refresh_from_db()

        self.assertNotEqual(first.pk, second.pk)
        self.assertEqual((first.is_current, second.is_current), (False, True))
        # Quay lại nội dung cũ thì bản cũ được dùng lại và thành hiện hành.
        Job.objects.filter(pk=self.job.pk).update(requirements=self.job.requirements)
        again = ensure_job_document(jobs_for_profile().get(pk=self.job.pk), encoder=encoder)
        second.refresh_from_db()
        self.assertEqual((again.pk, again.is_current, second.is_current), (first.pk, True, False))
