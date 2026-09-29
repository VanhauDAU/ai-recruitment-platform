from decimal import Decimal

from django.test import SimpleTestCase, override_settings

from ..services import AiGenerationError, AiRuntimeConfig


class AiRuntimeConfigTests(SimpleTestCase):
    @override_settings(
        AI_RUNTIME_ENABLED=True,
        AI_PROVIDER_BACKEND='gemini_developer',
        AI_JOB_GENERATION_MODEL='gemini-test',
        GEMINI_API_KEY='secret-key',
        GOOGLE_CLOUD_PROJECT='',
        GOOGLE_CLOUD_LOCATION='global',
        AI_PROVIDER_TIMEOUT_SECONDS=25,
        AI_PROVIDER_MAX_ATTEMPTS=9,
        AI_MODEL_PRICING_USD={
            'gemini-test': {'input': '0.25', 'output': '1.50'},
        },
    )
    def test_resolves_supported_settings_and_caps_calls_at_two(self):
        config = AiRuntimeConfig.from_django_settings()

        self.assertTrue(config.enabled)
        self.assertEqual(config.provider_backend, 'gemini_developer')
        self.assertEqual(config.model, 'gemini-test')
        self.assertEqual(config.gemini_api_key, 'secret-key')
        self.assertEqual(config.timeout_seconds, 25)
        self.assertEqual(config.max_attempts, 2)
        self.assertEqual(config.input_cost_per_million_usd, Decimal('0.25'))
        self.assertEqual(config.output_cost_per_million_usd, Decimal('1.50'))

    def test_runtime_disabled_is_a_safe_normalized_error(self):
        with self.assertRaises(AiGenerationError) as caught:
            AiRuntimeConfig(enabled=False).validate()

        self.assertEqual(caught.exception.code, 'runtime_disabled')
        self.assertEqual(str(caught.exception), 'runtime_disabled')

    def test_developer_mode_requires_api_key(self):
        with self.assertRaises(AiGenerationError) as caught:
            AiRuntimeConfig(enabled=True, gemini_api_key='').validate()

        self.assertEqual(caught.exception.code, 'provider_not_configured')

    def test_vertex_mode_requires_project_and_location(self):
        config = AiRuntimeConfig(
            enabled=True,
            provider_backend='vertex',
            google_cloud_project='',
            google_cloud_location='global',
        )

        with self.assertRaises(AiGenerationError) as caught:
            config.validate()

        self.assertEqual(caught.exception.code, 'provider_not_configured')

    def test_unknown_backend_is_rejected_before_credentials(self):
        with self.assertRaises(AiGenerationError) as caught:
            AiRuntimeConfig(enabled=True, provider_backend='other').validate()

        self.assertEqual(caught.exception.code, 'unsupported_provider_backend')
