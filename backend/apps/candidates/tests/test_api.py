from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.jobs.models import JobCategory
from apps.locations.models import Location
from apps.skills.models import Skill

from ..models import (
    CandidateConsent,
    CandidateConsentEvent,
    CandidateDesiredPositionOther,
    CandidateJobPreference,
    CandidatePreferredSkill,
)


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
            code='01',
            name='Hà Nội',
            level=Location.Level.PROVINCE,
        )
        self.ward = Location.objects.create(
            code='00001',
            name='Phường Ba Đình',
            level=Location.Level.WARD,
            parent=self.province,
        )
        self.skill = Skill.objects.create(name='Python')
        self.other_skill = Skill.objects.create(name='Django')
        self.inactive_skill = Skill.objects.create(name='Legacy framework', is_active=False)

    def test_profile_is_owned_by_request_user_and_returns_settings_fields_only(self):
        response = self.client.get('/api/candidate/profile/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(set(response.data), {'gender'})

        response = self.client.patch(
            '/api/candidate/profile/',
            {'gender': 'male'},
            format='json',
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, {'gender': 'male'})
        self.user.candidate_profile.refresh_from_db()
        self.assertEqual(self.user.candidate_profile.gender, 'male')

    def preference_payload(self, **overrides):
        payload = {
            'desired_specialization_ids': [self.specialization.pk, self.other_specialization.pk],
            'desired_position_other': '  AI engineer  ',
            'desired_salary_vnd': 25_000_000,
            'experience_level': CandidateJobPreference.ExperienceLevel.THREE,
            'preferred_province_ids': [self.province.pk],
            'preferred_skill_ids': [self.skill.pk, self.other_skill.pk],
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
        self.assertEqual(response.data['desired_position_others'], [])
        self.assertEqual(response.data['preferred_skills'], [])
        self.assertFalse(response.data['ai_recommendation_consent'])

    def test_job_preferences_are_candidate_only(self):
        anonymous = APIClient()
        self.assertEqual(anonymous.get('/api/candidate/job-preferences/').status_code, 401)

        employer = get_user_model().objects.create_user(
            email='employer@example.com',
            password='password',
            role='employer',
        )
        anonymous.force_authenticate(employer)
        self.assertEqual(anonymous.get('/api/candidate/job-preferences/').status_code, 403)

    def test_job_preference_put_replaces_selections_and_marks_profile_configured(self):
        response = self.client.put(
            '/api/candidate/job-preferences/',
            self.preference_payload(),
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['job_preferences_configured'])
        self.assertEqual(response.data['desired_position_other'], 'AI engineer')
        self.assertEqual(response.data['desired_position_others'], ['AI engineer'])
        self.assertEqual(
            [item['id'] for item in response.data['desired_specializations']],
            [
                self.specialization.pk,
                self.other_specialization.pk,
            ],
        )
        self.assertTrue(response.data['recruiter_visibility_consent'])
        self.assertFalse(response.data['ai_recommendation_consent'])
        self.assertEqual(
            [item['id'] for item in response.data['preferred_skills']],
            [self.skill.pk, self.other_skill.pk],
        )
        self.user.candidate_profile.refresh_from_db()
        self.assertTrue(self.user.candidate_profile.job_preferences_configured)
        self.assertEqual(
            CandidateConsent.objects.get(
                candidate_profile=self.user.candidate_profile,
                consent_type=CandidateConsent.ConsentType.AI_RECOMMENDATION,
            ).decision,
            CandidateConsent.Decision.DENIED,
        )

    def test_job_preference_get_prefetches_all_normalized_selections(self):
        saved = self.client.put(
            '/api/candidate/job-preferences/',
            self.preference_payload(
                desired_position_others=['AI Engineer', 'Data Engineer'],
            ),
            format='json',
        )
        self.assertEqual(saved.status_code, 200, saved.data)

        with self.assertNumQueries(8):
            response = self.client.get('/api/candidate/job-preferences/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['desired_position_others'], ['AI Engineer', 'Data Engineer'])
        self.assertEqual(len(response.data['preferred_skills']), 2)

    def test_job_preference_normalizes_blank_other_position_to_null(self):
        response = self.client.put(
            '/api/candidate/job-preferences/',
            self.preference_payload(desired_position_other='   '),
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.data['desired_position_other'])

    def test_job_preference_accepts_normalized_custom_only_positions(self):
        category_count = JobCategory.objects.count()
        response = self.client.put(
            '/api/candidate/job-preferences/',
            self.preference_payload(
                desired_specialization_ids=[],
                desired_position_other='Legacy value is ignored',
                desired_position_others=[
                    '  AI Engineer ',
                    'ai engineer',
                    ' ',
                    'Data Engineer',
                    'DATA ENGINEER',
                    '',
                ],
            ),
            format='json',
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['desired_position_others'], ['AI Engineer', 'Data Engineer'])
        self.assertEqual(response.data['desired_position_other'], 'AI Engineer')
        self.assertEqual(response.data['desired_specializations'], [])
        self.assertEqual(JobCategory.objects.count(), category_count)
        preference = CandidateJobPreference.objects.get(
            candidate_profile=self.user.candidate_profile
        )
        self.assertEqual(
            list(
                CandidateDesiredPositionOther.objects.filter(job_preference=preference).values_list(
                    'name', flat=True
                )
            ),
            ['AI Engineer', 'Data Engineer'],
        )

    def test_legacy_scalar_supports_custom_only_position(self):
        response = self.client.put(
            '/api/candidate/job-preferences/',
            self.preference_payload(
                desired_specialization_ids=[],
                desired_position_other='  Platform Engineer  ',
            ),
            format='json',
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['desired_position_other'], 'Platform Engineer')
        self.assertEqual(response.data['desired_position_others'], ['Platform Engineer'])

    def test_job_preference_allows_five_standard_and_five_custom_positions(self):
        extra_categories = [
            JobCategory.objects.create(
                name=f'Chuyên môn {index}',
                category_type=JobCategory.CategoryType.SPECIALIZATION,
            )
            for index in range(3)
        ]
        response = self.client.put(
            '/api/candidate/job-preferences/',
            self.preference_payload(
                desired_specialization_ids=[
                    self.specialization.pk,
                    self.other_specialization.pk,
                    *(category.pk for category in extra_categories),
                ],
                desired_position_others=[f'Vị trí tự nhập {index}' for index in range(5)],
            ),
            format='json',
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(len(response.data['desired_specializations']), 5)
        self.assertEqual(len(response.data['desired_position_others']), 5)

    def test_job_preference_rejects_more_than_five_standard_positions(self):
        extra_categories = [
            JobCategory.objects.create(
                name=f'Chuyên môn giới hạn {index}',
                category_type=JobCategory.CategoryType.SPECIALIZATION,
            )
            for index in range(4)
        ]
        response = self.client.put(
            '/api/candidate/job-preferences/',
            self.preference_payload(
                desired_specialization_ids=[
                    self.specialization.pk,
                    self.other_specialization.pk,
                    *(category.pk for category in extra_categories),
                ],
                desired_position_others=[],
            ),
            format='json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn('desired_specialization_ids', response.data)

    def test_job_preference_rejects_more_than_five_custom_positions(self):
        response = self.client.put(
            '/api/candidate/job-preferences/',
            self.preference_payload(
                desired_specialization_ids=[],
                desired_position_others=[f'Vị trí tự nhập {index}' for index in range(6)],
            ),
            format='json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn('desired_position_others', response.data)

    def test_job_preference_rejects_empty_standard_and_custom_positions(self):
        response = self.client.put(
            '/api/candidate/job-preferences/',
            self.preference_payload(
                desired_specialization_ids=[],
                desired_position_other=None,
                desired_position_others=['  '],
            ),
            format='json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn('desired_specialization_ids', response.data)

    def test_job_preference_normalizes_deduplicates_and_returns_skills(self):
        response = self.client.put(
            '/api/candidate/job-preferences/',
            self.preference_payload(
                preferred_skill_ids=[self.skill.pk, self.skill.pk, self.other_skill.pk],
            ),
            format='json',
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(
            response.data['preferred_skills'],
            [
                {'id': self.skill.pk, 'name': 'Python', 'slug': 'python'},
                {'id': self.other_skill.pk, 'name': 'Django', 'slug': 'django'},
            ],
        )
        self.assertEqual(CandidatePreferredSkill.objects.count(), 2)

    def test_job_preference_preserves_skills_when_legacy_client_omits_new_field(self):
        initial = self.client.put(
            '/api/candidate/job-preferences/',
            self.preference_payload(preferred_skill_ids=[self.skill.pk]),
            format='json',
        )
        self.assertEqual(initial.status_code, 200, initial.data)
        legacy_payload = self.preference_payload(desired_position_other='Platform Engineer')
        legacy_payload.pop('preferred_skill_ids')

        response = self.client.put(
            '/api/candidate/job-preferences/',
            legacy_payload,
            format='json',
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['desired_position_others'], ['Platform Engineer'])
        self.assertEqual(
            [item['id'] for item in response.data['preferred_skills']], [self.skill.pk]
        )

    def test_job_preference_explicit_empty_skill_list_clears_selection(self):
        initial = self.client.put(
            '/api/candidate/job-preferences/',
            self.preference_payload(preferred_skill_ids=[self.skill.pk]),
            format='json',
        )
        self.assertEqual(initial.status_code, 200, initial.data)

        response = self.client.put(
            '/api/candidate/job-preferences/',
            self.preference_payload(preferred_skill_ids=[]),
            format='json',
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['preferred_skills'], [])
        self.assertFalse(CandidatePreferredSkill.objects.exists())

    def test_job_preference_rejects_inactive_skill_without_partial_update(self):
        initial = self.client.put(
            '/api/candidate/job-preferences/',
            self.preference_payload(
                desired_position_other='Original position',
                preferred_skill_ids=[self.skill.pk],
            ),
            format='json',
        )
        self.assertEqual(initial.status_code, 200, initial.data)

        rejected = self.client.put(
            '/api/candidate/job-preferences/',
            self.preference_payload(
                desired_position_other='Changed position',
                preferred_skill_ids=[self.inactive_skill.pk],
            ),
            format='json',
        )

        self.assertEqual(rejected.status_code, 400)
        self.assertIn('preferred_skill_ids', rejected.data)
        preference = CandidateJobPreference.objects.get(
            candidate_profile=self.user.candidate_profile
        )
        self.assertEqual(preference.desired_position_other, 'Original position')
        self.assertEqual(
            list(preference.preferred_skills.values_list('skill_id', flat=True)),
            [self.skill.pk],
        )

    def test_job_preference_rejects_more_than_twenty_skills(self):
        skills = [Skill.objects.create(name=f'Skill {index}') for index in range(21)]
        response = self.client.put(
            '/api/candidate/job-preferences/',
            self.preference_payload(preferred_skill_ids=[skill.pk for skill in skills]),
            format='json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn('preferred_skill_ids', response.data)
        self.assertFalse(CandidatePreferredSkill.objects.exists())

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
            '/api/candidate/job-preferences/',
            self.preference_payload(desired_salary_vnd=0),
            format='json',
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

    def test_recruiter_visibility_requires_confirmation_and_writes_audit_event(self):
        url = '/api/candidate/recruiter-visibility/'
        rejected = self.client.patch(
            url,
            {
                'enabled': True,
                'confirmed': False,
                'policy_version': 'v1',
                'source': 'cv_save_success',
                'source_path': '/save-cv-success/cv_1',
            },
            format='json',
        )
        self.assertEqual(rejected.status_code, 400)
        self.assertFalse(CandidateConsentEvent.objects.exists())

        accepted = self.client.patch(
            url,
            {
                'enabled': True,
                'confirmed': True,
                'policy_version': 'v1',
                'source': 'cv_save_success',
                'source_path': '/save-cv-success/cv_1',
            },
            format='json',
        )
        self.assertEqual(accepted.status_code, 200, accepted.data)
        self.assertTrue(accepted.data['enabled'])
        event = CandidateConsentEvent.objects.get()
        self.assertEqual(event.source, 'cv_save_success')
        self.assertEqual(event.decision, CandidateConsent.Decision.GRANTED)

        disabled = self.client.patch(
            url,
            {
                'enabled': False,
                'source': 'account_settings',
                'policy_version': 'v1',
            },
            format='json',
        )
        self.assertEqual(disabled.status_code, 200)
        self.assertFalse(disabled.data['enabled'])
        self.assertEqual(CandidateConsentEvent.objects.count(), 2)
