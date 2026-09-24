import hashlib
from decimal import Decimal

from django.test import TestCase

from ..models import AiInvocation, AiUsageDaily
from ..selectors import ai_usage_overview
from ..services import (
    AiGenerationError,
    AiRuntimeConfig,
    GenerationAttempt,
    ProviderGenerationResult,
    TokenUsage,
    generate_structured,
    record_ai_quota_rejection,
)


class FakeProvider:
    provider_name = 'gemini'
    provider_backend = 'gemini_developer'
    model = 'gemini-test'

    def __init__(self, result=None, error=None):
        self.result = result
        self.error = error
        self.calls = []

    def generate_structured(self, **kwargs):
        self.calls.append(kwargs)
        if self.error:
            raise self.error
        return self.result


class AiRuntimeTests(TestCase):
    def config(self):
        return AiRuntimeConfig(
            enabled=True,
            provider_backend='gemini_developer',
            model='gemini-test',
            input_cost_per_million_usd=Decimal('1'),
            output_cost_per_million_usd=Decimal('2'),
        )

    def success_result(self, *, latency_ms=25):
        return ProviderGenerationResult(
            data={'title': 'Kỹ sư Backend'},
            usage=TokenUsage(
                input_tokens=100,
                output_tokens=50,
                total_tokens=150,
                cached_tokens=10,
            ),
            attempts=(GenerationAttempt(number=1, status='succeeded', latency_ms=latency_ms),),
            provider_request_id='provider-request-1',
            finish_reason='STOP',
        )

    def generate(self, provider, **overrides):
        values = {
            'use_case': 'job_post_generation',
            'prompt': 'private recruiter brief candidate@example.com',
            'response_schema': {'type': 'object'},
            'prompt_version': 'job-post-v1',
            'schema_version': 'job-post-v1',
            'correlation_key': 'jag_123',
            'runtime_config': self.config(),
            'provider': provider,
        }
        values.update(overrides)
        return generate_structured(**values)

    def test_success_persists_only_hashes_and_operational_metadata(self):
        prompt = 'private recruiter brief candidate@example.com'
        provider = FakeProvider(result=self.success_result())

        result = self.generate(provider)

        invocation = AiInvocation.objects.get(pk=result.invocation_id)
        self.assertEqual(result.data, {'title': 'Kỹ sư Backend'})
        self.assertEqual(invocation.status, AiInvocation.Status.SUCCEEDED)
        self.assertEqual(invocation.prompt_sha256, hashlib.sha256(prompt.encode()).hexdigest())
        self.assertEqual(invocation.input_tokens, 100)
        self.assertEqual(invocation.output_tokens, 50)
        self.assertEqual(invocation.cost_usd, Decimal('0.00020000'))
        self.assertEqual(invocation.latency_ms, 25)
        self.assertEqual(invocation.provider_request_id, 'provider-request-1')
        persisted_text = ' '.join(
            str(getattr(invocation, field.name))
            for field in invocation._meta.fields
            if field.get_internal_type() in {'CharField', 'TextField'}
        )
        self.assertNotIn(prompt, persisted_text)
        self.assertNotIn('candidate@example.com', persisted_text)

        usage = AiUsageDaily.objects.get()
        self.assertEqual(usage.invocation_count, 1)
        self.assertEqual(usage.success_count, 1)
        self.assertEqual(usage.failure_count, 0)
        self.assertEqual(usage.input_tokens, 100)
        self.assertEqual(usage.cost_usd, Decimal('0.00020000'))

    def test_normalized_failure_is_persisted_without_original_error_text(self):
        attempts = (
            GenerationAttempt(
                number=1,
                status='failed',
                latency_ms=20,
                error_code='rate_limited',
                retryable=True,
            ),
            GenerationAttempt(
                number=2,
                status='failed',
                latency_ms=30,
                error_code='rate_limited',
                retryable=True,
            ),
        )
        provider = FakeProvider(
            error=AiGenerationError('rate_limited', retryable=True, attempts=attempts)
        )

        with self.assertRaises(AiGenerationError) as caught:
            self.generate(provider)

        invocation = AiInvocation.objects.get(pk=caught.exception.invocation_id)
        self.assertEqual(caught.exception.code, 'rate_limited')
        self.assertTrue(caught.exception.retryable)
        self.assertEqual(caught.exception.correlation_key, 'jag_123')
        self.assertEqual(invocation.status, AiInvocation.Status.FAILED)
        self.assertEqual(invocation.error_code, 'rate_limited')
        self.assertEqual(invocation.attempt_count, 2)
        self.assertEqual(invocation.retry_count, 1)
        self.assertEqual(invocation.latency_ms, 50)
        usage = AiUsageDaily.objects.get()
        self.assertEqual(usage.failure_count, 1)
        self.assertEqual(usage.retry_count, 1)

    def test_unexpected_provider_exception_is_normalized(self):
        provider = FakeProvider(error=RuntimeError('source prompt secret@example.com'))

        with self.assertRaises(AiGenerationError) as caught:
            self.generate(provider)

        self.assertEqual(str(caught.exception), 'provider_failed')
        self.assertNotIn('secret@example.com', str(caught.exception))
        self.assertEqual(AiInvocation.objects.get().error_code, 'provider_failed')

    def test_global_switch_fails_before_creating_an_invocation(self):
        provider = FakeProvider(result=self.success_result())

        with self.assertRaises(AiGenerationError) as caught:
            self.generate(provider, runtime_config=AiRuntimeConfig(enabled=False))

        self.assertEqual(caught.exception.code, 'runtime_disabled')
        self.assertFalse(AiInvocation.objects.exists())
        self.assertFalse(AiUsageDaily.objects.exists())

    def test_quota_rejection_has_a_durable_counter_without_invocation(self):
        record_ai_quota_rejection(
            use_case='job_post_generation',
            provider='gemini',
            provider_backend='gemini_developer',
            model='gemini-test',
        )
        record_ai_quota_rejection(
            use_case='job_post_generation',
            provider='gemini',
            provider_backend='gemini_developer',
            model='gemini-test',
        )

        usage = AiUsageDaily.objects.get()
        self.assertEqual(usage.quota_rejection_count, 2)
        self.assertEqual(usage.invocation_count, 0)
        self.assertFalse(AiInvocation.objects.exists())

    def test_overview_aggregates_daily_usage_and_exact_p95(self):
        self.generate(FakeProvider(result=self.success_result(latency_ms=10)))
        self.generate(FakeProvider(result=self.success_result(latency_ms=90)))
        record_ai_quota_rejection(
            use_case='job_post_generation',
            provider='gemini',
            provider_backend='gemini_developer',
            model='gemini-test',
        )

        overview = ai_usage_overview(days=7, use_case='job_post_generation')

        self.assertEqual(overview['invocation_count'], 2)
        self.assertEqual(overview['success_count'], 2)
        self.assertEqual(overview['quota_rejection_count'], 1)
        self.assertEqual(overview['total_tokens'], 300)
        self.assertEqual(overview['cost_usd'], Decimal('0.00040000'))
        self.assertEqual(overview['p95_latency_ms'], 90)
        self.assertEqual(len(overview['series']), 1)

    def test_overview_rejects_unbounded_window(self):
        with self.assertRaisesMessage(ValueError, 'between 1 and 365'):
            ai_usage_overview(days=366)
