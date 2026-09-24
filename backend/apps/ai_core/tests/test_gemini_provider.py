import sys
from types import SimpleNamespace
from unittest.mock import patch

from django.test import SimpleTestCase

from ..services import AiGenerationError, AiRuntimeConfig
from ..services.providers import GeminiStructuredOutputProvider


class FakeModels:
    def __init__(self, *results):
        self.results = list(results)
        self.calls = []

    def generate_content(self, **kwargs):
        self.calls.append(kwargs)
        result = self.results.pop(0)
        if isinstance(result, Exception):
            raise result
        return result


class FakeClient:
    def __init__(self, *results):
        self.models = FakeModels(*results)


class HttpFailure(Exception):
    def __init__(self, status_code, sensitive_message='must-not-escape'):
        self.status_code = status_code
        super().__init__(sensitive_message)


def successful_response():
    return SimpleNamespace(
        parsed={'title': 'Backend Engineer'},
        text=None,
        prompt_feedback=None,
        usage_metadata=SimpleNamespace(
            prompt_token_count=120,
            candidates_token_count=80,
            total_token_count=200,
            cached_content_token_count=20,
        ),
        candidates=[SimpleNamespace(finish_reason=SimpleNamespace(value='STOP'))],
        sdk_http_response=SimpleNamespace(headers={'x-goog-request-id': 'request-123'}),
    )


class GeminiStructuredOutputProviderTests(SimpleTestCase):
    def config(self, **overrides):
        values = {
            'enabled': True,
            'gemini_api_key': 'test-key',
            'model': 'gemini-test',
            'retry_base_seconds': 0.25,
        }
        values.update(overrides)
        return AiRuntimeConfig(**values)

    def test_generates_json_schema_and_normalizes_response_metadata(self):
        client = FakeClient(successful_response())
        provider = GeminiStructuredOutputProvider(self.config(), client=client)

        result = provider.generate_structured(
            prompt='source prompt',
            system_instruction='follow policy',
            response_schema={'type': 'object', 'properties': {'title': {'type': 'string'}}},
        )

        self.assertEqual(result.data, {'title': 'Backend Engineer'})
        self.assertEqual(result.usage.input_tokens, 120)
        self.assertEqual(result.usage.cached_tokens, 20)
        self.assertEqual(result.provider_request_id, 'request-123')
        self.assertEqual(result.finish_reason, 'STOP')
        call = client.models.calls[0]
        self.assertEqual(call['model'], 'gemini-test')
        self.assertEqual(call['contents'], 'source prompt')
        self.assertEqual(call['config']['response_mime_type'], 'application/json')
        self.assertEqual(call['config']['system_instruction'], 'follow policy')
        self.assertIn('response_json_schema', call['config'])

    def test_retries_one_transient_failure_and_reports_each_attempt(self):
        client = FakeClient(HttpFailure(429), successful_response())
        sleeps = []
        timestamps = iter([0.0, 0.1, 0.1, 0.3])
        provider = GeminiStructuredOutputProvider(
            self.config(),
            client=client,
            sleep=sleeps.append,
            monotonic=lambda: next(timestamps),
        )

        result = provider.generate_structured(
            prompt='prompt',
            response_schema={'type': 'object'},
        )

        self.assertEqual(len(client.models.calls), 2)
        self.assertEqual(sleeps, [0.25])
        self.assertEqual([item.status for item in result.attempts], ['failed', 'succeeded'])
        self.assertEqual(result.attempts[0].error_code, 'rate_limited')

    def test_retries_a_semantically_invalid_result_and_counts_both_responses(self):
        invalid = successful_response()
        invalid.parsed = {'title': ''}
        client = FakeClient(invalid, successful_response())
        provider = GeminiStructuredOutputProvider(
            self.config(retry_base_seconds=0.001),
            client=client,
            sleep=lambda _delay: None,
        )

        def require_title(data):
            if not data.get('title'):
                raise AiGenerationError('invalid_ai_schema', retryable=True)

        result = provider.generate_structured(
            prompt='prompt',
            response_schema={'type': 'object'},
            result_validator=require_title,
        )

        self.assertEqual(len(client.models.calls), 2)
        self.assertEqual([item.status for item in result.attempts], ['failed', 'succeeded'])
        self.assertEqual(result.attempts[0].error_code, 'invalid_ai_schema')
        self.assertEqual(result.usage.input_tokens, 240)
        self.assertEqual(result.usage.output_tokens, 160)

    def test_does_not_retry_non_transient_client_error_or_leak_message(self):
        client = FakeClient(HttpFailure(400, 'candidate@example.com source prompt'))
        provider = GeminiStructuredOutputProvider(self.config(), client=client)

        with self.assertRaises(AiGenerationError) as caught:
            provider.generate_structured(
                prompt='candidate@example.com source prompt',
                response_schema={'type': 'object'},
            )

        self.assertEqual(caught.exception.code, 'invalid_provider_request')
        self.assertFalse(caught.exception.retryable)
        self.assertEqual(len(client.models.calls), 1)
        self.assertNotIn('candidate@example.com', str(caught.exception))

    def test_invalid_json_gets_exactly_one_repair_attempt(self):
        invalid = SimpleNamespace(
            parsed=None,
            text='not json',
            prompt_feedback=None,
        )
        client = FakeClient(invalid, invalid)
        provider = GeminiStructuredOutputProvider(
            self.config(retry_base_seconds=0.001),
            client=client,
            sleep=lambda _delay: None,
        )

        with self.assertRaises(AiGenerationError) as caught:
            provider.generate_structured(prompt='prompt', response_schema={'type': 'object'})

        self.assertEqual(caught.exception.code, 'invalid_response')
        self.assertTrue(caught.exception.retryable)
        self.assertEqual(len(caught.exception.attempts), 2)
        self.assertEqual(len(client.models.calls), 2)

    def test_content_block_is_not_retried(self):
        response = SimpleNamespace(
            parsed=None,
            text=None,
            prompt_feedback=SimpleNamespace(block_reason='SAFETY'),
        )
        client = FakeClient(response)
        provider = GeminiStructuredOutputProvider(self.config(), client=client)

        with self.assertRaises(AiGenerationError) as caught:
            provider.generate_structured(prompt='prompt', response_schema={'type': 'object'})

        self.assertEqual(caught.exception.code, 'content_blocked')
        self.assertEqual(len(client.models.calls), 1)

    def test_default_client_uses_developer_api_arguments(self):
        calls = []
        fake_genai = SimpleNamespace(Client=lambda **kwargs: calls.append(kwargs) or FakeClient())
        fake_types = SimpleNamespace(HttpOptions=lambda **kwargs: kwargs)
        fake_google = SimpleNamespace(genai=fake_genai)
        fake_genai.types = fake_types

        with patch.dict(
            sys.modules,
            {'google': fake_google, 'google.genai': fake_genai},
        ):
            provider = GeminiStructuredOutputProvider(self.config())
            client = provider.client

        self.assertIsInstance(client, FakeClient)
        self.assertEqual(calls[0]['api_key'], 'test-key')
        self.assertNotIn('vertexai', calls[0])
        self.assertEqual(calls[0]['http_options']['api_version'], 'v1')
        self.assertEqual(calls[0]['http_options']['timeout'], 40000)

    def test_default_client_uses_vertex_project_and_location(self):
        calls = []
        fake_genai = SimpleNamespace(Client=lambda **kwargs: calls.append(kwargs) or FakeClient())
        fake_types = SimpleNamespace(HttpOptions=lambda **kwargs: kwargs)
        fake_google = SimpleNamespace(genai=fake_genai)
        fake_genai.types = fake_types
        config = self.config(
            provider_backend='vertex',
            gemini_api_key='',
            google_cloud_project='production-project',
            google_cloud_location='asia-southeast1',
        )

        with patch.dict(
            sys.modules,
            {'google': fake_google, 'google.genai': fake_genai},
        ):
            provider = GeminiStructuredOutputProvider(config)
            client = provider.client

        self.assertIsInstance(client, FakeClient)
        self.assertTrue(calls[0]['vertexai'])
        self.assertEqual(calls[0]['project'], 'production-project')
        self.assertEqual(calls[0]['location'], 'asia-southeast1')
