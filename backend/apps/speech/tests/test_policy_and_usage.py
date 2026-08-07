from unittest.mock import patch

from django.core.cache import cache
from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.sitecontent.models import SiteSetting
from apps.speech.models import SpeechUsageDaily
from apps.speech.services import (
    SpeechQuotaExceeded,
    get_speech_policy,
    record_speech_usage,
    reserve_generation_quota,
    speech_surface_config,
)
from apps.speech.services.client import SpeechServiceUnavailable

LOCAL_CACHE = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        'LOCATION': 'speech-policy-tests',
    }
}


@override_settings(
    CACHES=LOCAL_CACHE,
    SPEECH_RUNTIME_ENABLED=True,
    SPEECH_POLICY_CACHE_SECONDS=60,
    SPEECH_GENERATION_RESERVATION_SECONDS=180,
)
class SpeechPolicyAndUsageTests(TestCase):
    def setUp(self):
        cache.clear()
        values = {
            'speech_enabled': True,
            'speech_live_enabled': True,
            'speech_blog_enabled': True,
            'speech_onboarding_enabled': False,
            'speech_chatbot_enabled': True,
            'speech_interview_enabled': False,
            'speech_daily_authenticated_limit': 30,
            'speech_daily_anonymous_limit': 2,
            'speech_blog_voice_id': 'north-male-natural',
            'speech_blog_style': 'tu_nhien',
            'speech_assistant_voice_id': 'north-female-news',
            'speech_assistant_style': 'tin_tuc',
        }
        for key, value in values.items():
            SiteSetting.objects.update_or_create(
                key=key,
                defaults={
                    'label': key,
                    'group': SiteSetting.Group.AI,
                    'value': value,
                },
            )
        cache.clear()

    def test_policy_combines_hard_switch_master_and_surface_flags(self):
        policy = get_speech_policy()

        self.assertIs(policy['speech_blog_enabled'], True)
        self.assertIs(policy['speech_onboarding_enabled'], False)
        self.assertEqual(speech_surface_config('chatbot')['voice_id'], 'north-female-news')

    @override_settings(SPEECH_RUNTIME_ENABLED=False)
    def test_environment_switch_cannot_be_overridden_by_database(self):
        cache.clear()

        policy = get_speech_policy()

        self.assertIs(policy['runtime_enabled'], False)
        self.assertIs(policy['speech_enabled'], False)
        self.assertIs(policy['speech_blog_enabled'], False)

    def test_same_artifact_reservation_consumes_quota_once(self):
        first = reserve_generation_quota(
            artifact_key='a' * 64,
            surface='blog',
            subject='127.0.0.1',
            authenticated=False,
            limit=1,
        )
        shared = reserve_generation_quota(
            artifact_key='a' * 64,
            surface='blog',
            subject='127.0.0.1',
            authenticated=False,
            limit=1,
        )

        self.assertIs(first, True)
        self.assertIs(shared, False)
        with self.assertRaises(SpeechQuotaExceeded):
            reserve_generation_quota(
                artifact_key='b' * 64,
                surface='blog',
                subject='127.0.0.1',
                authenticated=False,
                limit=1,
            )

    def test_usage_is_aggregated_without_request_or_user_rows(self):
        record_speech_usage(
            'chatbot',
            session_count=1,
            generation_count=1,
            requested_chars=120,
            cache_miss_count=1,
        )
        record_speech_usage('chatbot', session_count=1, requested_chars=120, cache_hit_count=1)

        usage = SpeechUsageDaily.objects.get(surface='chatbot')
        self.assertEqual(usage.session_count, 2)
        self.assertEqual(usage.generation_count, 1)
        self.assertEqual(usage.requested_chars, 240)
        self.assertEqual(usage.cache_hit_count, 1)
        self.assertEqual(usage.cache_miss_count, 1)

    @patch('apps.speech.api.views.speech.tts_service_client.status')
    def test_superuser_overview_degrades_when_runtime_is_unavailable(self, status):
        status.side_effect = SpeechServiceUnavailable
        admin = User.objects.create_superuser(
            email='speech-admin@example.com', password='Password@123'
        )
        client = APIClient()
        client.force_authenticate(admin)

        response = client.get(reverse('speech-admin-overview'))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['runtime']['status'], 'unavailable')
        self.assertIn('days_30', response.data['usage'])
