from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.jobs.models import JobCategory
from apps.locations.models import Location

from .models import CandidateConsent, CandidateJobPreference


class CandidateProfileApiTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            email='candidate@example.com',
            password='password',
            role='candidate',
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.specialization = JobCategory.objects.create(
            name='Kỹ sư phần mềm',
            category_type=JobCategory.CategoryType.SPECIALIZATION,
        )
        self.other_specialization = JobCategory.objects.create(
            name='Kiểm thử phần mềm',
            category_type=JobCategory.CategoryType.SPECIALIZATION,
        )
        self.non_specialization = JobCategory.objects.create(
            name='Công nghệ thông tin',
            category_type=JobCategory.CategoryType.DOMAIN,
        )
        self.province = Location.objects.create(
            code='01', name='Hà Nội', level=Location.Level.PROVINCE,
        )
        self.ward = Location.objects.create(
            code='00001', name='Phường Ba Đình', level=Location.Level.WARD, parent=self.province,
        )

    def test_profile_is_owned_by_request_user_and_updates_through_service(self):
        response = self.client.get('/api/candidate/profile/')
        self.assertEqual(response.status_code, 200)

        response = self.client.patch(
            '/api/candidate/profile/',
            {'headline': 'Backend engineer', 'experience_years': '3.5'},
            format='json',
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['headline'], 'Backend engineer')
        self.assertEqual(str(response.data['experience_years']), '3.5')

    def preference_payload(self, **overrides):
        payload = {
            'desired_specialization_ids': [self.specialization.pk, self.other_specialization.pk],
            'desired_position_other': '  AI engineer  ',
            'desired_salary_vnd': 25_000_000,
            'experience_level': CandidateJobPreference.ExperienceLevel.THREE,
            'preferred_province_ids': [self.province.pk],
            'willing_to_relocate': True,
            'ai_recommendation_consent': False,
            'recruiter_visibility_consent': True,
        }
        payload.update(overrides)
        return payload

    def test_job_preference_get_returns_unconfigured_shell(self):
        response = self.client.get('/api/candidate/job-preferences/')

        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data['job_preferences_configured'])
        self.assertEqual(response.data['desired_specializations'], [])
        self.assertFalse(response.data['ai_recommendation_consent'])

    def test_job_preferences_are_candidate_only(self):
        anonymous = APIClient()
        self.assertEqual(anonymous.get('/api/candidate/job-preferences/').status_code, 401)

        employer = get_user_model().objects.create_user(
            email='employer@example.com', password='password', role='employer',
        )
        anonymous.force_authenticate(employer)
        self.assertEqual(anonymous.get('/api/candidate/job-preferences/').status_code, 403)

    def test_job_preference_put_replaces_selections_and_marks_profile_configured(self):
        response = self.client.put(
            '/api/candidate/job-preferences/', self.preference_payload(), format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['job_preferences_configured'])
        self.assertEqual(response.data['desired_position_other'], 'AI engineer')
        self.assertEqual([item['id'] for item in response.data['desired_specializations']], [
            self.specialization.pk, self.other_specialization.pk,
        ])
        self.assertTrue(response.data['recruiter_visibility_consent'])
        self.assertFalse(response.data['ai_recommendation_consent'])
        self.user.candidate_profile.refresh_from_db()
        self.assertTrue(self.user.candidate_profile.job_preferences_configured)
        self.assertEqual(
            CandidateConsent.objects.get(
                candidate_profile=self.user.candidate_profile,
                consent_type=CandidateConsent.ConsentType.AI_RECOMMENDATION,
            ).decision,
            CandidateConsent.Decision.DENIED,
        )

    def test_job_preference_normalizes_blank_other_position_to_null(self):
        response = self.client.put(
            '/api/candidate/job-preferences/',
            self.preference_payload(desired_position_other='   '),
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.data['desired_position_other'])

    def test_job_preference_rejects_non_specialization_and_ward(self):
        response = self.client.put(
            '/api/candidate/job-preferences/',
            self.preference_payload(
                desired_specialization_ids=[self.non_specialization.pk],
                preferred_province_ids=[self.ward.pk],
            ),
            format='json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn('desired_specialization_ids', response.data)
        self.user.candidate_profile.refresh_from_db()
        self.assertFalse(self.user.candidate_profile.job_preferences_configured)

    def test_job_preference_rejects_zero_salary_without_partial_save(self):
        response = self.client.put(
            '/api/candidate/job-preferences/', self.preference_payload(desired_salary_vnd=0), format='json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn('desired_salary_vnd', response.data)
        self.assertFalse(CandidateConsent.objects.exists())

    def test_job_preference_requires_salary_without_partial_save(self):
        payload = self.preference_payload()
        payload.pop('desired_salary_vnd')

        response = self.client.put('/api/candidate/job-preferences/', payload, format='json')

        self.assertEqual(response.status_code, 400)
        self.assertIn('desired_salary_vnd', response.data)
        self.assertFalse(CandidateConsent.objects.exists())
