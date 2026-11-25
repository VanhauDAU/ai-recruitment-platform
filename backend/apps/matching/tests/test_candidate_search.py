"""Một CV được bật, hồ sơ trích xuất và Tìm CV (TC-32…38)."""

import json

from django.core.cache import cache
from django.urls import reverse

from apps.applications.models import CandidateBlock, CandidateSearchInvitation
from apps.applications.services import create_application_record
from apps.candidates.models import CandidateNotification, CandidateProfile
from apps.candidates.services import set_recruiter_visibility
from apps.cv_templates.models import CvTemplate
from apps.cvs.models import CvAccessLog, UserCv
from apps.cvs.services import create_user_cv, permanently_delete_cv, update_cv_metadata
from apps.sitecontent.models import SiteSetting

from ..domain import RECRUITER_SEARCH, public_cv_profile, redact_name
from ..models import jobs_for_profile
from ..services import SkillCatalog, ensure_cv_document, ensure_job_document, get_encoder
from .test_api import MatchingApiBase


def grant_search_consent(user):
    profile, _created = CandidateProfile.objects.get_or_create(user=user)
    set_recruiter_visibility(profile, enabled=True, source='test')
    return profile


class SearchBase(MatchingApiBase):
    def setUp(self):
        cache.clear()
        SiteSetting.objects.update_or_create(
            key='ai_candidate_search_enabled', defaults={'value': True}
        )
        self.cv = UserCv.objects.get(public_id=self.cv_ids[0])
        self.profile = grant_search_consent(self.candidate)
        update_cv_metadata(cv=self.cv, actor=self.candidate, recruiter_searchable=True)
        encoder = get_encoder()
        self.cv.refresh_from_db()
        ensure_cv_document(self.cv.latest_version, encoder=encoder, catalog=SkillCatalog.load())
        ensure_job_document(jobs_for_profile().get(pk=self.job.pk), encoder=encoder)
        self.client.force_authenticate(self.employer)

    def search(self, **params):
        return self.client.get(
            reverse('recruiter-candidate-search'), {'job': self.job.public_id, **params}
        )

    def only_candidate(self):
        response = self.search()
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['count'], 1)
        return response.data['results'][0]


class OneSearchableCvTests(SearchBase):
    def test_turning_on_another_cv_turns_the_previous_one_off(self):  # TC-32
        template = CvTemplate.objects.first()
        second = create_user_cv(actor=self.candidate, title='CV thứ hai', template=template)

        update_cv_metadata(cv=second, actor=self.candidate, recruiter_searchable=True)

        self.assertEqual(
            list(
                UserCv.objects.filter(user=self.candidate, recruiter_searchable=True).values_list(
                    'pk', flat=True
                )
            ),
            [second.pk],
        )


class ExtractedProfileTests(SearchBase):
    def test_owner_sees_the_profile_extracted_from_the_cv(self):
        self.client.force_authenticate(self.candidate)

        data = self.client.get(reverse('matching-cv-profile', args=[self.cv.public_id])).data

        self.assertEqual(data['status'], 'ready')
        self.assertEqual(data['profile']['title'], 'Frontend Developer')
        sections = {section['key']: section['items'] for section in data['profile']['sections']}
        job = sections['experience'][0]
        self.assertEqual(
            (job['title'], job['subtitle'], job['start']),
            ('Frontend Developer', 'Công ty A', '2024-06'),
        )
        self.assertEqual(job['lines'], ['Xây dựng trang thanh toán bằng ReactJS và TypeScript.'])
        self.assertEqual(sections['education'][0]['subtitle'], 'ĐH B')
        self.assertIn('summary', sections)
        self.assertNotIn('chunks', data['profile'])

    def test_another_candidate_cannot_read_it(self):
        self.client.force_authenticate(self.other)
        response = self.client.get(reverse('matching-cv-profile', args=[self.cv.public_id]))
        self.assertEqual(response.status_code, 404)

    def test_recruiter_search_view_keeps_cv_content_without_evidence_or_unsorted_text(
        self,
    ):  # TC-33
        item = {'title': '', 'subtitle': '', 'start': None, 'end': None}
        profile = {
            'source': 'upload',
            'title': 'Kế toán',
            'skills': [{'name': 'Excel', 'group': '', 'evidence': 'Câu bằng chứng bí mật'}],
            'experience': {'months': 12, 'band': '1', 'basis': 'dates', 'items': [{'text': 'x'}]},
            'education': {'level': 'university'},
            'position_level': 'employee',
            'languages': [{'code': 'en', 'level': 'working', 'evidence': 'IELTS bí mật'}],
            'chunks': [{'index': 0, 'section': 'experience', 'text': 'Chunk bí mật'}],
            'sections': [
                {
                    'key': 'experience',
                    'items': [{**item, 'lines': ['Kế toán viên, Nguyễn Văn An phụ trách thuế']}],
                },
                {'key': 'other', 'items': [{**item, 'lines': ['Ngày sinh 01/01/1990']}]},
            ],
            'quality': {'missing': []},
        }

        shown = redact_name(public_cv_profile(profile, audience=RECRUITER_SEARCH), 'Nguyễn Văn An')
        text = json.dumps(shown, ensure_ascii=False)

        self.assertIn('phụ trách thuế', text)
        self.assertIn('[ứng viên]', text)
        for hidden in ('bí mật', 'Ngày sinh', 'Nguyễn Văn An'):
            self.assertNotIn(hidden, text)
        self.assertEqual([section['key'] for section in shown['sections']], ['experience'])


class CandidateSearchTests(SearchBase):
    def test_results_are_ranked_and_anonymous(self):  # TC-33
        row = self.only_candidate()

        self.assertEqual(row['title'], 'Frontend Developer')
        self.assertGreaterEqual(row['score'], 30)
        self.assertEqual(row['matched_skills'], ['ReactJS'])
        self.assertEqual((row['applied'], row['invited']), (False, False))
        self.assertEqual(len(row['ref']), 24)
        body = json.dumps(self.search().data, ensure_ascii=False, default=str)
        for secret in (self.candidate.email, self.candidate.full_name or '\x00'):
            self.assertNotIn(secret, body)
        self.assertNotIn(self.cv.public_id, body)

    def test_candidate_disappears_when_consent_or_the_cv_switch_is_withdrawn(self):  # TC-34
        set_recruiter_visibility(self.profile, enabled=False, source='test')
        self.assertEqual(self.search().data['count'], 0)

    def test_blocked_candidate_is_hidden_and_applicant_is_flagged(self):  # TC-35
        create_application_record(candidate=self.candidate, job=self.job, cv=self.cv)
        self.assertTrue(self.only_candidate()['applied'])

        CandidateBlock.objects.create(
            company=self.job.company,
            candidate=self.candidate,
            recruiter=self.employer,
            reason=CandidateBlock.Reason.values[0],
        )
        self.assertEqual(self.search().data['count'], 0)

    def test_filters_use_the_extracted_profile(self):
        self.assertEqual(self.search(q='Frontend').data['count'], 1)
        self.assertEqual(self.search(q='Kế toán').data['count'], 0)
        self.assertEqual(self.search(min_months=600).data['count'], 0)
        self.assertEqual(self.search(education='postgraduate').data['count'], 0)

    def test_quick_view_is_audited_and_carries_no_contact_or_evidence(self):  # TC-37
        row = self.only_candidate()
        url = reverse('recruiter-candidate-search-detail', args=[row['ref']])

        detail = self.client.get(url, {'job': self.job.public_id}).data

        self.assertEqual(detail['profile']['title'], 'Frontend Developer')
        keys = [section['key'] for section in detail['profile']['sections']]
        self.assertIn('experience', keys)
        self.assertNotIn('other', keys)
        self.assertNotIn(self.candidate.email, json.dumps(detail, ensure_ascii=False, default=str))
        self.assertEqual(detail['result']['requirements'], [])
        self.assertTrue(all(not s['evidence'] for s in detail['result']['skills']['matched']))
        log = CvAccessLog.objects.get(access_channel=CvAccessLog.AccessChannel.RECRUITER_SEARCH)
        self.assertEqual(
            (log.actor_user, log.version, log.cv), (self.employer, self.cv.latest_version, self.cv)
        )

    def test_candidate_can_still_delete_a_cv_recruiters_have_viewed(self):
        row = self.only_candidate()
        url = reverse('recruiter-candidate-search-detail', args=[row['ref']])
        self.client.get(url, {'job': self.job.public_id})
        # Nhật ký cũ chỉ gắn với phiên bản (không gắn CV) cũng không được chặn việc xóa.
        CvAccessLog.objects.create(
            version=self.cv.latest_version,
            actor_user=self.employer,
            actor_type=CvAccessLog.ActorType.RECRUITER,
            access_channel=CvAccessLog.AccessChannel.RECRUITER_SEARCH,
        )

        permanently_delete_cv(cv=self.cv, actor=self.candidate)

        self.assertFalse(UserCv.objects.filter(pk=self.cv.pk).exists())
        self.assertFalse(CvAccessLog.objects.exists())
        self.assertEqual(self.search().data['count'], 0)

    def test_invitation_is_sent_once_per_job(self):  # TC-36
        row = self.only_candidate()
        url = reverse('recruiter-candidate-search-invite', args=[row['ref']])

        with self.captureOnCommitCallbacks(execute=True):
            first = self.client.post(url, {'job': self.job.public_id}, format='json')
        second = self.client.post(url, {'job': self.job.public_id}, format='json')

        self.assertEqual((first.status_code, second.status_code), (204, 409))
        self.assertEqual(CandidateSearchInvitation.objects.count(), 1)
        self.assertTrue(
            CandidateNotification.objects.filter(
                recipient=self.candidate,
                event_type=CandidateNotification.EventType.JOB_INVITATION,
            ).exists()
        )
        self.assertTrue(self.only_candidate()['invited'])

    def test_unknown_code_and_foreign_job_are_not_found(self):
        url = reverse('recruiter-candidate-search-detail', args=['0' * 24])
        self.assertEqual(self.client.get(url, {'job': self.job.public_id}).status_code, 404)
        self.assertEqual(self.search(job='job_does_not_exist').status_code, 404)

    def test_disabled_feature_is_reported(self):  # TC-38
        SiteSetting.objects.filter(key='ai_candidate_search_enabled').update(value=False)
        cache.clear()

        response = self.search()

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data['code'], 'feature_disabled')
