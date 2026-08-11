from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from ..models import (
    CandidateConsent,
    CandidateEmailNotificationSettings,
    CandidateJobPreference,
)


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
            email_verified=True,
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def test_get_returns_safe_defaults_without_creating_settings(self):
        self.assertFalse(CandidateEmailNotificationSettings.objects.exists())

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(set(response.data), self.field_names)
        self.assertFalse(response.data['suitable_job_recommendations'])
        self.assertTrue(
            all(
                value
                for key, value in response.data.items()
                if key != 'suitable_job_recommendations'
            )
        )
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
        self.assertFalse(settings.suitable_job_recommendations)

    def test_enabling_suitable_recommendations_requires_configured_preferences(self):
        response = self.client.patch(
            self.url,
            {'suitable_job_recommendations': True},
            format='json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['code'], 'preferences_required')
        self.assertFalse(CandidateEmailNotificationSettings.objects.exists())

    def test_enabling_suitable_recommendations_requires_ai_consent(self):
        profile = self.user.candidate_profile
        profile.job_preferences_configured = True
        profile.save(update_fields=['job_preferences_configured', 'updated_at'])
        CandidateJobPreference.objects.create(candidate_profile=profile)

        response = self.client.patch(
            self.url,
            {'suitable_job_recommendations': True},
            format='json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['code'], 'consent_required')

    def test_candidate_can_opt_in_after_granting_ai_consent(self):
        profile = self.user.candidate_profile
        profile.job_preferences_configured = True
        profile.save(update_fields=['job_preferences_configured', 'updated_at'])
        CandidateJobPreference.objects.create(candidate_profile=profile)
        CandidateConsent.objects.create(
            candidate_profile=profile,
            consent_type=CandidateConsent.ConsentType.AI_RECOMMENDATION,
            decision=CandidateConsent.Decision.GRANTED,
        )

        response = self.client.patch(
            self.url,
            {'suitable_job_recommendations': True},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['suitable_job_recommendations'])

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

    def test_unverified_candidate_cannot_reenable_job_email_but_can_disable(self):
        settings = CandidateEmailNotificationSettings.objects.create(
            candidate_profile=self.user.candidate_profile,
            configured_job_alerts=False,
        )
        self.user.email_verified = False
        self.user.save(update_fields=['email_verified', 'updated_at'])

        enabled = self.client.patch(
            self.url,
            {'configured_job_alerts': True},
            format='json',
        )
        self.assertEqual(enabled.status_code, 400)
        self.assertEqual(enabled.data['code'], 'email_unverified')
        settings.refresh_from_db()
        self.assertFalse(settings.configured_job_alerts)

        settings.configured_job_alerts = True
        settings.save(update_fields=['configured_job_alerts', 'updated_at'])
        disabled = self.client.patch(
            self.url,
            {'configured_job_alerts': False},
            format='json',
        )
        self.assertEqual(disabled.status_code, 200)
        self.assertFalse(disabled.data['configured_job_alerts'])

    @patch(
        'apps.jobs.services.reset_candidate_job_delivery_cursors',
        side_effect=RuntimeError('cursor reset failed'),
    )
    def test_cursor_reset_failure_rolls_back_preference_transition(self, _reset):
        settings = CandidateEmailNotificationSettings.objects.create(
            candidate_profile=self.user.candidate_profile,
            configured_job_alerts=False,
        )
        self.client.raise_request_exception = False

        response = self.client.patch(
            self.url,
            {'configured_job_alerts': True},
            format='json',
        )

        self.assertEqual(response.status_code, 500)
        settings.refresh_from_db()
        self.assertFalse(settings.configured_job_alerts)
