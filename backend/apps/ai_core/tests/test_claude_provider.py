import sys
from types import SimpleNamespace
from unittest.mock import patch

from django.test import SimpleTestCase

from ..services import AiGenerationError, AiRuntimeConfig
from ..services.providers import (
    ClaudeStructuredOutputProvider,
    GeminiStructuredOutputProvider,
    provider_for,
)
from ..services.providers.claude import MAX_OUTPUT_TOKENS, claude_json_schema


class FakeMessages:
    def __init__(self, *results):
        self.results = list(results)
        self.calls = []

    def create(self, **kwargs):
        self.calls.append(kwargs)
        result = self.results.pop(0)
        if isinstance(result, Exception):
            raise result
        return result


class FakeClient:
    def __init__(self, *results):
        self.messages = FakeMessages(*results)


class HttpFailure(Exception):
    def __init__(self, status_code, sensitive_message='must-not-escape'):
        self.status_code = status_code
        super().__init__(sensitive_message)


class APIConnectionError(Exception):
    """Same class name as the SDK's network error."""


def claude_response(text='{"title": "Backend Engineer"}', stop_reason='end_turn'):
    response = SimpleNamespace(
        content=[
            SimpleNamespace(type='thinking', thinking=''),
            SimpleNamespace(type='text', text=text),
        ],
        stop_reason=stop_reason,
        usage=SimpleNamespace(
            input_tokens=100,
            cache_creation_input_tokens=10,
            cache_read_input_tokens=30,
            output_tokens=80,
        ),
    )
    response._request_id = 'req_123'
    return response


class ClaudeJsonSchemaTests(SimpleTestCase):
    def test_closes_objects_and_drops_unsupported_constraints(self):
        schema = {
            'type': 'object',
            'properties': {
                'title': {'type': 'string', 'minLength': 3, 'maxLength': 120},
                'start': {'type': 'string', 'pattern': r'^\d{4}$', 'format': 'year-month'},
                'when': {'type': 'string', 'format': 'date'},
                'tags': {
                    'type': 'array',
                    'minItems': 3,
                    'maxItems': 10,
                    'items': {'type': 'object', 'properties': {'name': {'type': 'string'}}},
                },
                'level': {'type': 'string', 'enum': ['junior', 'senior']},
            },
            'required': ['title'],
            'additionalProperties': True,
        }

        adapted = claude_json_schema(schema)

        self.assertIs(adapted['additionalProperties'], False)
        self.assertEqual(adapted['properties']['title'], {'type': 'string'})
        self.assertEqual(adapted['properties']['start'], {'type': 'string'})
        self.assertEqual(adapted['properties']['when'], {'type': 'string', 'format': 'date'})
        tags = adapted['properties']['tags']
        self.assertNotIn('minItems', tags)
        self.assertIs(tags['items']['additionalProperties'], False)
        self.assertEqual(adapted['properties']['level']['enum'], ['junior', 'senior'])
        self.assertEqual(adapted['required'], ['title'])
        # The caller's schema is reused by Gemini and validators: never mutated.
        self.assertEqual(schema['properties']['title']['minLength'], 3)


class ClaudeStructuredOutputProviderTests(SimpleTestCase):
    def config(self, **overrides):
        values = {
            'enabled': True,
            'provider_backend': 'anthropic',
            'anthropic_api_key': 'test-key',
            'model': 'claude-test',
            'retry_base_seconds': 0.25,
        }
        values.update(overrides)
        return AiRuntimeConfig(**values)

    def provider(self, client, **overrides):
        return ClaudeStructuredOutputProvider(
            self.config(**overrides), client=client, sleep=lambda _: None
        )

    def test_sends_json_schema_output_config_and_reads_the_text_block(self):
        client = FakeClient(claude_response())

        result = self.provider(client).generate_structured(
            prompt='source prompt',
            system_instruction='follow policy',
            response_schema={'type': 'object', 'properties': {'title': {'type': 'string'}}},
        )

        self.assertEqual(result.data, {'title': 'Backend Engineer'})
        self.assertEqual(result.usage.input_tokens, 140)
        self.assertEqual(result.usage.cached_tokens, 30)
        self.assertEqual(result.usage.total_tokens, 220)
        self.assertEqual(result.provider_request_id, 'req_123')
        self.assertEqual(result.finish_reason, 'end_turn')
        call = client.messages.calls[0]
        self.assertEqual(call['model'], 'claude-test')
        self.assertEqual(call['max_tokens'], MAX_OUTPUT_TOKENS)
        self.assertEqual(call['system'], 'follow policy')
        self.assertEqual(call['messages'], [{'role': 'user', 'content': 'source prompt'}])
        output_format = call['output_config']['format']
        self.assertEqual(output_format['type'], 'json_schema')
        self.assertIs(output_format['schema']['additionalProperties'], False)
        self.assertNotIn('effort', call['output_config'])
        self.assertNotIn('temperature', call)

    def test_configured_effort_is_sent(self):
        client = FakeClient(claude_response())

        self.provider(client, anthropic_effort='low').generate_structured(
            prompt='p', response_schema={'type': 'object'}
        )

        self.assertEqual(client.messages.calls[0]['output_config']['effort'], 'low')

    def test_refusal_is_not_retried(self):
        client = FakeClient(claude_response(stop_reason='refusal'))

        with self.assertRaises(AiGenerationError) as caught:
            self.provider(client).generate_structured(
                prompt='p', response_schema={'type': 'object'}
            )

        self.assertEqual(caught.exception.code, 'content_blocked')
        self.assertEqual(len(client.messages.calls), 1)

    def test_truncated_output_is_not_retried(self):
        client = FakeClient(claude_response(text='{"title": "Ba', stop_reason='max_tokens'))

        with self.assertRaises(AiGenerationError) as caught:
            self.provider(client).generate_structured(
                prompt='p', response_schema={'type': 'object'}
            )

        self.assertEqual(caught.exception.code, 'invalid_response')
        self.assertEqual(len(client.messages.calls), 1)

    def test_invalid_json_gets_one_more_attempt(self):
        client = FakeClient(claude_response(text='not json'), claude_response())

        result = self.provider(client).generate_structured(
            prompt='p', response_schema={'type': 'object'}
        )

        self.assertEqual(result.data, {'title': 'Backend Engineer'})
        self.assertEqual([a.status for a in result.attempts], ['failed', 'succeeded'])
        self.assertEqual(result.usage.output_tokens, 160)

    def test_exhausted_credit_is_a_non_retryable_quota_error(self):
        client = FakeClient(HttpFailure(402))

        with self.assertRaises(AiGenerationError) as caught:
            self.provider(client).generate_structured(
                prompt='p', response_schema={'type': 'object'}
            )

        self.assertEqual(caught.exception.code, 'provider_quota_exhausted')
        self.assertNotIn('must-not-escape', str(caught.exception))
        self.assertEqual(len(client.messages.calls), 1)

    def test_overload_and_network_errors_are_retried(self):
        for failure in (HttpFailure(529), APIConnectionError('down')):
            with self.subTest(failure=type(failure).__name__):
                client = FakeClient(failure, claude_response())

                result = self.provider(client).generate_structured(
                    prompt='p', response_schema={'type': 'object'}
                )

                self.assertEqual(len(result.attempts), 2)

    def test_default_client_disables_sdk_retries_and_uses_runtime_timeout(self):
        calls = []
        fake_sdk = SimpleNamespace(Anthropic=lambda **kwargs: calls.append(kwargs) or 'client')

        with patch.dict(sys.modules, {'anthropic': fake_sdk}):
            provider = ClaudeStructuredOutputProvider(self.config(timeout_seconds=30))
            client = provider.client

        self.assertEqual(client, 'client')
        self.assertEqual(calls, [{'api_key': 'test-key', 'timeout': 30, 'max_retries': 0}])


class ProviderSelectionTests(SimpleTestCase):
    def test_backend_selects_the_provider(self):
        claude = provider_for(
            AiRuntimeConfig(
                enabled=True, provider_backend='anthropic', anthropic_api_key='k', model='m'
            )
        )
        gemini = provider_for(AiRuntimeConfig(enabled=True, gemini_api_key='k', model='m'))

        self.assertIsInstance(claude, ClaudeStructuredOutputProvider)
        self.assertEqual(claude.provider_name, 'anthropic')
        self.assertIsInstance(gemini, GeminiStructuredOutputProvider)

    def test_anthropic_backend_requires_api_key(self):
        with self.assertRaises(AiGenerationError) as caught:
            AiRuntimeConfig(enabled=True, provider_backend='anthropic', model='m').validate()

        self.assertEqual(caught.exception.code, 'provider_not_configured')
