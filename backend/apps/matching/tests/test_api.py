"""API `/api/candidate/matching/analyses/` theo các kịch bản nghiệm thu (kế hoạch mục 10c)."""

from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase
from rest_framework.throttling import ScopedRateThrottle

from apps.cv_templates.tests.factories import make_published_template
from apps.cvs.models import CvVersion, UserCv
from apps.cvs.services import create_v2_cv, create_version, import_cv_documents
from apps.employers.models import Company
from apps.employers.tests.readiness_helpers import make_employer_ready
from apps.jobs.models import Job, JobSkill
from apps.jobs.tests.helpers import open_visibility_window
from apps.sitecontent.models import SiteSetting
from apps.skills.models import Skill

from ..models import MatchAnalysis, MatchDocument
from ..selectors import owner_cv_for_matching, public_job_for_profile
from ..services import recover_stale_analyses, request_analysis

CV_DATA = {
    'headline': 'Frontend Developer',
    'summary': 'Hai năm phát triển giao diện web bằng ReactJS.',
    'experience': [
        {
            'role': 'Frontend Developer',
            'company': 'Công ty A',
            'start_date': '2024-06',
            'end_date': None,
            'highlights': ['Xây dựng trang thanh toán bằng ReactJS và TypeScript.'],
        }
    ],
    'education': {'degree': 'Cử nhân CNTT', 'institution': 'ĐH B', 'degree_level': 'university'},
    'skills': [{'name': 'ReactJS', 'level': 4}],
    'languages': [{'language': 'Tiếng Anh', 'level': 'Giao tiếp', 'certificate': ''}],
}


class MatchingApiBase(APITestCase):
    @classmethod
    def setUpTestData(cls):
        User = get_user_model()
        employer = User.objects.create_user(
            email='match-api-employer@example.com', password='x', role='employer'
        )
        company = Company.objects.create(company_name='Match API Co', created_by=employer)
        make_employer_ready(employer, company=company, candidate_data=True)
        cls.employer = employer
        cls.job = Job.objects.create(
            posted_by=employer,
            company=company,
            title='Frontend Developer (ReactJS)',
            description='<ul><li>Phát triển giao diện thương mại điện tử cho khách hàng lớn.</li></ul>'
            * 4,
            requirements='<ul><li>Có 2 năm kinh nghiệm ReactJS.</li><li>Viết test tự động.</li></ul>',
            experience_years=Job.ExperienceYears.TWO,
            education_level=Job.EducationLevel.UNIVERSITY,
            position_level=Job.PositionLevel.EMPLOYEE,
            status=Job.Status.ACTIVE,
            deadline=timezone.localdate() + timedelta(days=30),
            first_approved_at=timezone.now(),
            published_at=timezone.now(),
            **open_visibility_window(),
        )
        JobSkill.objects.create(job=cls.job, skill=Skill.objects.create(name='ReactJS'))
        make_published_template('Match API template')
        report = import_cv_documents(
            [
                {'code': 'CV-901', 'language': 'vi', 'data': CV_DATA},
                {'code': 'CV-902', 'language': 'vi', 'data': CV_DATA},
            ],
            apply=True,
        )
        cls.cv_ids = [row['cv_public_id'] for row in report['rows']]
        cls.candidate = User.objects.get(email='cv-901@synthetic.procv.test')
        cls.other = User.objects.get(email='cv-902@synthetic.procv.test')

    def setUp(self):
        cache.clear()
        SiteSetting.objects.update_or_create(key='ai_job_match_enabled', defaults={'value': True})
        self.client.force_authenticate(self.candidate)

    def request(self, cv=None, job=None):
        with self.captureOnCommitCallbacks(execute=True):
            return self.client.post(
                reverse('matching-analyses'),
                {'job': job or self.job.slug, 'cv': cv or self.cv_ids[0]},
                format='json',
            )


class MatchingApiTests(MatchingApiBase):
    def test_candidate_gets_a_scored_explained_result(self):  # TC-01
        response = self.request()
        self.assertEqual(response.status_code, 202, response.data)
        detail = self.client.get(
            reverse('matching-analysis-detail', args=[response.data['public_id']])
        )
        self.assertEqual(detail.data['status'], 'succeeded', detail.data)
        result = detail.data['result']
        self.assertEqual(
            set(result),
            {
                'overall',
                'components',
                'skills',
                'requirements',
                'suggestions',
                'flags',
                'disclaimer',
                'meta',
            },
        )
        self.assertEqual(result['meta']['model_version'], 'hashing-v1')
        self.assertEqual(result['skills']['matched'][0]['name'], 'ReactJS')
        self.assertEqual(detail.data['overall_score'], result['overall']['score'])
        self.assertEqual(MatchDocument.objects.filter(status='ready').count(), 2)

    def test_request_queues_the_task_once_after_commit(self):
        cv = owner_cv_for_matching(self.candidate, self.cv_ids[0])
        job = public_job_for_profile(self.job.slug)
        with patch('apps.matching.tasks.run_analysis.delay') as delay:
            with self.captureOnCommitCallbacks(execute=True):
                analysis = request_analysis(user=self.candidate, job=job, cv=cv)
                delay.assert_not_called()
            with self.captureOnCommitCallbacks(execute=True):
                again = request_analysis(user=self.candidate, job=job, cv=cv)

        self.assertEqual(again.pk, analysis.pk)
        delay.assert_called_once_with(analysis.pk)

    def test_same_pair_is_served_from_cache(self):  # TC-06
        first = self.request()
        second = self.request()
        self.assertEqual(second.status_code, 200)
        self.assertTrue(second.data['cached'])
        self.assertEqual(second.data['public_id'], first.data['public_id'])
        self.assertEqual(MatchAnalysis.objects.count(), 1)

    def test_editing_the_cv_computes_a_new_result(self):  # TC-07
        self.request()
        cv = UserCv.objects.get(public_id=self.cv_ids[0])
        latest = cv.latest_version
        content = {
            **latest.content_json,
            'personal_info': {
                **latest.content_json['personal_info'],
                'headline': 'React Developer',
            },
        }
        create_version(
            cv=cv,
            actor=self.candidate,
            content_json=content,
            layout_json=latest.layout_json,
            style_json=latest.style_json,
            version_kind=CvVersion.VersionKind.MANUAL_SAVE,
            create_or_replace_draft=True,
        )
        self.assertEqual(self.request().status_code, 202)
        self.assertEqual(MatchAnalysis.objects.count(), 2)

    def test_template_sample_of_a_never_saved_cv_is_not_analysed(self):
        template, _version = make_published_template('Unsaved template')
        unsaved = create_v2_cv(actor=self.candidate, title='Chưa lưu', template=template)

        response = self.request(cv=unsaved.public_id)

        self.assertEqual((response.status_code, response.data['code']), (422, 'cv_not_saved'))
        self.assertFalse(MatchAnalysis.objects.filter(cv_version__cv=unsaved).exists())

    def test_only_candidates_and_only_their_own_data(self):  # TC-08, TC-09, TC-10
        own = self.request().data['public_id']
        self.client.force_authenticate(None)
        self.assertIn(self.request().status_code, (401, 403))
        self.client.force_authenticate(self.employer)
        self.assertEqual(self.request().status_code, 403)
        self.client.force_authenticate(self.other)
        self.assertEqual(
            self.client.get(reverse('matching-analysis-detail', args=[own])).status_code, 404
        )
        stolen = self.request(cv=self.cv_ids[0])
        self.assertEqual((stolen.status_code, stolen.data['code']), (404, 'cv_not_owned'))

    def test_feature_flag_off_refuses(self):  # TC-11
        SiteSetting.objects.filter(key='ai_job_match_enabled').update(value=False)
        response = self.request()
        self.assertEqual((response.status_code, response.data['code']), (403, 'feature_disabled'))

    def test_closed_job_is_refused(self):  # TC-13
        Job.objects.filter(pk=self.job.pk).update(status=Job.Status.CLOSED)
        response = self.request()
        self.assertEqual((response.status_code, response.data['code']), (404, 'job_not_active'))

    def test_requests_are_throttled_but_polling_is_not(self):  # TC-12
        with patch.object(ScopedRateThrottle, 'THROTTLE_RATES', {'match_analysis': '1/hour'}):
            public_id = self.request().data['public_id']
            self.assertEqual(self.request().status_code, 429)
            detail = reverse('matching-analysis-detail', args=[public_id])
            for _ in range(3):
                self.assertEqual(self.client.get(detail).status_code, 200)

    def test_recent_results_for_a_job(self):
        self.request()
        response = self.client.get(reverse('matching-analyses'), {'job': self.job.slug})
        self.assertEqual(response.status_code, 200)
        self.assertEqual([row['cv']['public_id'] for row in response.data], [self.cv_ids[0]])

    def test_failed_analysis_is_retried_on_the_next_request(self):
        public_id = self.request().data['public_id']
        MatchAnalysis.objects.filter(public_id=public_id).update(
            status='failed', error_code='analysis_timeout'
        )
        self.assertEqual(self.request().status_code, 202)
        self.assertEqual(MatchAnalysis.objects.get(public_id=public_id).status, 'succeeded')


class RecoveryTests(MatchingApiBase):
    """Worker chết giữa chừng hay hàng đợi bị kẹt (TC-14) được vòng phục hồi xử lý."""

    def make(self, status, *, age, started=None):
        analysis = MatchAnalysis.objects.create(
            user=self.candidate,
            cv_version=UserCv.objects.get(public_id=self.cv_ids[0]).latest_version,
            job=self.job,
            job_content_hash=f'{status}-{age}',
            model_version='hashing-v1',
            scoring_version='hybrid-v1',
            status=status,
            started_at=started,
        )
        MatchAnalysis.objects.filter(pk=analysis.pk).update(created_at=timezone.now() - age)
        return analysis

    def test_stale_rows_are_requeued_redispatched_or_failed(self):
        now = timezone.now()
        waiting = self.make('queued', age=timedelta(minutes=1))
        fresh = self.make('queued', age=timedelta(seconds=5))
        abandoned = self.make(
            'processing', age=timedelta(minutes=3), started=now - timedelta(minutes=2)
        )
        expired = self.make('queued', age=timedelta(minutes=20))
        ids = recover_stale_analyses(now=now)
        self.assertEqual(set(ids), {waiting.pk, abandoned.pk})
        self.assertNotIn(fresh.pk, ids)
        expired.refresh_from_db()
        self.assertEqual((expired.status, expired.error_code), ('failed', 'analysis_timeout'))
