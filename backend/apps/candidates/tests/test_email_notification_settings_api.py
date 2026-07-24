from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from ..models import CandidateEmailNotificationSettings


class CandidateEmailNotificationSettingsApiTests(TestCase):
    url = '/api/candidate/email-notification-settings/'
    field_names = {
        'important_system_updates',
        'employer_viewed_cv',
        'new_features_and_cv_templates',
        'other_system_notifications',
        'configured_job_alerts',
        'suitable_job_recommendations',
        'top_candidate_alerts',
        'employer_invitations',
        'job_and_career_events',
        'service_introductions',
        'program_and_event_introductions',
        'partner_gifts_and_discounts',
    }

    def setUp(self):
        self.user = get_user_model().objects.create_user(
            email='candidate-notifications@example.com',
            password='password',
            role='candidate',
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def test_get_returns_enabled_defaults_without_creating_settings(self):
        self.assertFalse(CandidateEmailNotificationSettings.objects.exists())

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(set(response.data), self.field_names)
        self.assertTrue(all(response.data.values()))
        self.assertFalse(CandidateEmailNotificationSettings.objects.exists())

    def test_get_returns_persisted_choices(self):
        CandidateEmailNotificationSettings.objects.create(
            candidate_profile=self.user.candidate_profile,
            configured_job_alerts=False,
            service_introductions=False,
        )

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data['configured_job_alerts'])
        self.assertFalse(response.data['service_introductions'])
        self.assertTrue(response.data['important_system_updates'])
        self.assertEqual(CandidateEmailNotificationSettings.objects.count(), 1)

    def test_patch_creates_settings_and_preserves_unspecified_enabled_defaults(self):
        response = self.client.patch(
            self.url,
            {
                'suitable_job_recommendations': False,
                'partner_gifts_and_discounts': False,
            },
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data['suitable_job_recommendations'])
        self.assertFalse(response.data['partner_gifts_and_discounts'])
        self.assertTrue(response.data['important_system_updates'])
        settings = CandidateEmailNotificationSettings.objects.get()
        self.assertEqual(settings.candidate_profile, self.user.candidate_profile)

    def test_patch_is_partial_and_keeps_previous_choices(self):
        settings = CandidateEmailNotificationSettings.objects.create(
            candidate_profile=self.user.candidate_profile,
            configured_job_alerts=False,
            service_introductions=False,
        )

        response = self.client.patch(
            self.url,
            {'employer_viewed_cv': False},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        settings.refresh_from_db()
        self.assertFalse(settings.configured_job_alerts)
        self.assertFalse(settings.service_introductions)
        self.assertFalse(settings.employer_viewed_cv)
        self.assertTrue(settings.suitable_job_recommendations)

    def test_settings_are_candidate_only(self):
        anonymous = APIClient()
        self.assertEqual(anonymous.get(self.url).status_code, 401)
        self.assertEqual(
            anonymous.patch(self.url, {'configured_job_alerts': True}, format='json').status_code,
            401,
        )

        employer = get_user_model().objects.create_user(
            email='notification-employer@example.com',
            password='password',
            role='employer',
        )
        anonymous.force_authenticate(employer)
        self.assertEqual(anonymous.get(self.url).status_code, 403)
        self.assertEqual(
            anonymous.patch(self.url, {'configured_job_alerts': True}, format='json').status_code,
            403,
        )
        self.assertFalse(CandidateEmailNotificationSettings.objects.exists())

    def test_patch_rejects_invalid_boolean_without_writing(self):
        response = self.client.patch(
            self.url,
            {'configured_job_alerts': 'not-a-boolean'},
            format='json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn('configured_job_alerts', response.data)
        self.assertFalse(CandidateEmailNotificationSettings.objects.exists())
