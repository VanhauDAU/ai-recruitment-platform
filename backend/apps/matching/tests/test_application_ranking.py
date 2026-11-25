"""Xếp hạng hồ sơ ứng tuyển cho nhà tuyển dụng (TC-23…30, TC-40)."""

import inspect
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.urls import reverse
from django.utils import timezone

from apps.applications.models import Application
from apps.applications.services import automatic_rejection, create_application_record
from apps.cvs.models import UserCv
from apps.employers.models import Company
from apps.employers.tests.factories import make_employer_ready
from apps.sitecontent.models import SiteSetting

from ..models import MatchAnalysis
from ..selectors import recent_owner_analyses
from ..services import (
    SkillCatalog,
    applications_needing_score,
    get_encoder,
    recover_stale_analyses,
    score_application,
    stale_application_ids,
)
from .test_api import MatchingApiBase

RANKING = MatchAnalysis.Purpose.APPLICATION_RANKING


class ApplicationRankingBase(MatchingApiBase):
    def setUp(self):
        cache.clear()
        SiteSetting.objects.update_or_create(
            key='ai_application_ranking_enabled', defaults={'value': True}
        )
        self.consenting = self.apply(self.candidate, self.cv_ids[0], allow_ai_analysis=True)
        self.declining = self.apply(self.other, self.cv_ids[1], allow_ai_analysis=False)
        self.client.force_authenticate(self.employer)

    def apply(self, candidate, cv_public_id, **options):
        cv = UserCv.objects.get(public_id=cv_public_id)
        return create_application_record(candidate=candidate, job=self.job, cv=cv, **options)

    def score(self, application):
        return score_application(application.pk, encoder=get_encoder(), catalog=SkillCatalog.load())

    def list_rows(self, **params):
        response = self.client.get(reverse('recruiter-application-list'), params)
        self.assertEqual(response.status_code, 200, response.data)
        return response.data['results']


class ScoringTests(ApplicationRankingBase):
    def test_consenting_application_is_scored_on_the_submitted_snapshot(self):  # TC-29
        analysis = self.score(self.consenting)

        self.assertEqual(analysis.status, MatchAnalysis.Status.SUCCEEDED)
        self.assertEqual(analysis.purpose, RANKING)
        self.assertEqual(analysis.cv_version_id, self.consenting.submitted_cv_version_id)
        self.assertGreater(analysis.overall_score, 0)
        # Ứng viên không thấy bản chấm dành cho nhà tuyển dụng.
        self.assertEqual(recent_owner_analyses(self.candidate, self.job), [])
        # Gọi lại thì dùng kết quả cũ, không tạo hàng mới.
        self.assertEqual(self.score(self.consenting).pk, analysis.pk)
        self.assertEqual(MatchAnalysis.objects.filter(purpose=RANKING).count(), 1)

    def test_declining_candidate_and_disabled_feature_are_never_scored(self):  # TC-30
        self.assertIsNone(self.score(self.declining))
        SiteSetting.objects.filter(key='ai_application_ranking_enabled').update(value=False)
        cache.clear()
        self.assertIsNone(self.score(self.consenting))
        self.assertFalse(MatchAnalysis.objects.exists())

    def test_replaced_application_is_not_scored(self):
        Application.objects.filter(pk=self.consenting.pk).update(is_current=False)
        self.assertIsNone(self.score(self.consenting))

    def test_snapshot_is_scored_after_the_library_cv_is_deleted(self):  # TC-40
        # Bản chụp là bất biến; xóa CV trong thư viện chỉ gỡ con trỏ `cv` của nó.
        version = self.consenting.submitted_cv_version
        type(version).objects.filter(pk=version.pk).update(cv=None)

        self.assertEqual(self.score(self.consenting).status, MatchAnalysis.Status.SUCCEEDED)

    def test_editing_the_job_asks_for_a_new_score_and_keeps_the_old_one_visible(self):  # TC-26
        first = self.score(self.consenting)
        self.assertEqual(applications_needing_score(self.job), [])

        self.job.requirements = '<ul><li>Có 5 năm kinh nghiệm Java và Spring Boot.</li></ul>' * 3
        self.job.save(update_fields=['requirements'])
        job = type(self.job).objects.get(pk=self.job.pk)

        self.assertEqual(applications_needing_score(job), [self.consenting.pk])
        row = next(r for r in self.list_rows() if r['public_id'] == self.consenting.public_id)
        self.assertEqual(
            (row['ai_match_status'], row['ai_match_score']), ('ready', first.overall_score)
        )

    def test_background_rows_have_no_interactive_deadline(self):  # TC-27
        version = self.consenting.submitted_cv_version
        stuck = MatchAnalysis.objects.create(
            user=self.candidate,
            cv_version=version,
            job=self.job,
            job_content_hash='x' * 64,
            model_version='hashing-v1',
            scoring_version='hybrid-v2',
            purpose=RANKING,
        )
        MatchAnalysis.objects.filter(pk=stuck.pk).update(
            created_at=timezone.now() - timedelta(hours=1)
        )

        self.assertEqual(recover_stale_analyses(), [])
        stuck.refresh_from_db()
        self.assertEqual(stuck.status, MatchAnalysis.Status.QUEUED)
        self.assertEqual(stale_application_ids(), [self.consenting.pk])

    def test_automatic_rejection_never_reads_scores(self):  # TC-28
        source = inspect.getsource(automatic_rejection)
        self.assertNotIn('matching', source)
        self.assertNotIn('ai_match', source)


class RecruiterApiTests(ApplicationRankingBase):
    def test_list_shows_scores_and_sorts_by_match_without_hiding_anyone(self):  # TC-23, TC-24
        analysis = self.score(self.consenting)

        rows = self.list_rows(ordering='ai_match')

        self.assertEqual(
            [(row['public_id'], row['ai_match_status']) for row in rows],
            [(self.consenting.public_id, 'ready'), (self.declining.public_id, 'not_consented')],
        )
        self.assertEqual(rows[0]['ai_match_score'], analysis.overall_score)
        self.assertEqual(rows[0]['ai_match_level'], analysis.result_json['overall']['level'])
        self.assertIsNone(rows[1]['ai_match_score'])
        # Mặc định vẫn là mới nhất trước.
        self.assertEqual(self.list_rows()[0]['public_id'], self.declining.public_id)

    def test_unscored_consenting_application_is_pending(self):
        row = next(r for r in self.list_rows() if r['public_id'] == self.consenting.public_id)
        self.assertEqual((row['ai_match_status'], row['ai_match_score']), ('pending', None))

    def test_disabled_feature_returns_no_match_fields(self):  # TC-30
        self.score(self.consenting)
        SiteSetting.objects.filter(key='ai_application_ranking_enabled').update(value=False)
        cache.clear()

        for row in self.list_rows(ordering='ai_match'):
            self.assertIsNone(row['ai_match_status'])
            self.assertIsNone(row['ai_match_score'])
            self.assertIsNone(row['ai_match_level'])

    def test_detail_is_for_recruiters_only_and_has_no_cv_tips(self):
        self.score(self.consenting)
        url = reverse('recruiter-application-ai-match', args=[self.consenting.public_id])

        detail = self.client.get(url).data

        self.assertEqual(detail['status'], 'ready')
        self.assertNotIn('suggestions', detail['result'])
        self.assertNotIn('disclaimer', detail['result'])
        self.assertTrue(all('summary' not in c for c in detail['result']['components']))
        self.assertEqual(
            self.client.get(
                reverse('recruiter-application-ai-match', args=[self.declining.public_id])
            ).data,
            {'status': 'not_consented', 'analysed_at': None, 'error_code': '', 'result': None},
        )

    def test_another_recruiter_cannot_read_the_match(self):  # TC-25
        self.score(self.consenting)
        stranger = get_user_model().objects.create_user(
            email='ranking-stranger@example.com', password='x', role='employer'
        )
        make_employer_ready(
            stranger,
            company=Company.objects.create(company_name='Stranger Co', created_by=stranger),
            candidate_data=True,
        )
        self.client.force_authenticate(stranger)

        url = reverse('recruiter-application-ai-match', args=[self.consenting.public_id])
        self.assertEqual(self.client.get(url).status_code, 404)
        self.assertEqual(self.list_rows(), [])

    def test_extracted_profile_of_the_submitted_cv_needs_consent(self):
        self.score(self.consenting)

        ready = self.client.get(
            reverse('recruiter-application-cv-profile', args=[self.consenting.public_id])
        ).data
        declined = self.client.get(
            reverse('recruiter-application-cv-profile', args=[self.declining.public_id])
        ).data

        self.assertEqual(ready['status'], 'ready')
        self.assertEqual(ready['profile']['title'], 'Frontend Developer')
        self.assertIn('experience', [section['key'] for section in ready['profile']['sections']])
        self.assertEqual(declined, {'status': 'not_consented', 'error_code': '', 'profile': None})
