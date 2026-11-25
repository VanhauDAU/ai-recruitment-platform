"""Anthropic Claude adapter: JSON outputs via ``output_config.format``.

Claude's structured outputs accept a subset of JSON Schema (every object closed
with ``additionalProperties: false``; no length/count/numeric constraints), so
the schema is adapted here. Dropped constraints stay enforced by each use
case's ``result_validator`` and sanitizers, exactly as they are for Gemini.
API data is not used for model training by default.
"""

from __future__ import annotations

import json
from collections.abc import Mapping
from typing import Any

from ..config import ANTHROPIC_EFFORTS, AiRuntimeConfig
from ..contracts import AiGenerationError, TokenUsage
from .base import RetryingStructuredOutputProvider, _non_negative_int, _value

# Non-streaming request: the SDK keeps this under its HTTP timeout guard.
MAX_OUTPUT_TOKENS = 16000
_UNSUPPORTED_KEYWORDS = frozenset(
    {
        'minLength',
        'maxLength',
        'pattern',
        'minimum',
        'maximum',
        'exclusiveMinimum',
        'exclusiveMaximum',
        'multipleOf',
        'minItems',
        'maxItems',
        'uniqueItems',
    }
)
_SUPPORTED_STRING_FORMATS = frozenset(
    {'date-time', 'time', 'date', 'duration', 'email', 'hostname', 'uri', 'ipv4', 'ipv6', 'uuid'}
)


def claude_json_schema(schema: Any) -> Any:
    """Copy of ``schema`` restricted to what Claude's JSON outputs accept."""
    if isinstance(schema, list):
        return [claude_json_schema(item) for item in schema]
    if not isinstance(schema, Mapping):
        return schema
    adapted = {}
    for key, value in schema.items():
        if key in _UNSUPPORTED_KEYWORDS:
            continue
        if key == 'format' and value not in _SUPPORTED_STRING_FORMATS:
            continue
        if key in {'properties', '$defs', 'definitions'} and isinstance(value, Mapping):
            adapted[key] = {name: claude_json_schema(child) for name, child in value.items()}
        elif key in {'items', 'anyOf', 'allOf', 'oneOf', 'not'}:
            adapted[key] = claude_json_schema(value)
        else:
            adapted[key] = value
    if adapted.get('type') == 'object' or 'properties' in adapted:
        adapted['additionalProperties'] = False
    return adapted


class ClaudeStructuredOutputProvider(RetryingStructuredOutputProvider):
    provider_name = 'anthropic'

    @staticmethod
    def _default_client(config: AiRuntimeConfig):
        # Imported lazily: only AI workers ever build a client.
        import anthropic

        # Retries belong to the shared loop so every attempt is recorded once.
        return anthropic.Anthropic(
            api_key=config.anthropic_api_key,
            timeout=config.timeout_seconds,
            max_retries=0,
        )

    def _request(self, *, prompt, response_schema, system_instruction):
        params = {
            'model': self.model,
            'max_tokens': MAX_OUTPUT_TOKENS,
            'messages': [{'role': 'user', 'content': prompt}],
            'output_config': {
                'format': {'type': 'json_schema', 'schema': claude_json_schema(response_schema)}
            },
        }
        if self.config.anthropic_effort in ANTHROPIC_EFFORTS:
            params['output_config']['effort'] = self.config.anthropic_effort
        if system_instruction:
            params['system'] = system_instruction
        return self.client.messages.create(**params)

    @staticmethod
    def _response_data(response):
        stop_reason = _value(response, 'stop_reason')
        if stop_reason == 'refusal':
            raise AiGenerationError('content_blocked')
        if stop_reason == 'max_tokens':
            # Cùng max_tokens thì thử lại vẫn bị cắt: không retry.
            raise AiGenerationError('invalid_response')
        text = next(
            (
                _value(block, 'text')
                for block in _value(response, 'content', []) or []
                if _value(block, 'type') == 'text'
            ),
            None,
        )
        if not isinstance(text, str) or not text.strip():
            raise AiGenerationError('empty_response', retryable=True)
        try:
            parsed = json.loads(text)
        except (TypeError, ValueError):
            raise AiGenerationError('invalid_response', retryable=True) from None
        if not isinstance(parsed, Mapping):
            raise AiGenerationError('invalid_response', retryable=True)
        return dict(parsed)

    @staticmethod
    def _usage(response):
        usage = _value(response, 'usage', {}) or {}
        cache_read = _non_negative_int(_value(usage, 'cache_read_input_tokens'))
        input_tokens = (
            _non_negative_int(_value(usage, 'input_tokens'))
            + _non_negative_int(_value(usage, 'cache_creation_input_tokens'))
            + cache_read
        )
        output_tokens = _non_negative_int(_value(usage, 'output_tokens'))
        return TokenUsage(
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            total_tokens=input_tokens + output_tokens,
            cached_tokens=cache_read,
        )

    @staticmethod
    def _finish_reason(response):
        return str(_value(response, 'stop_reason') or '')[:64]

    @staticmethod
    def _provider_request_id(response):
        return str(getattr(response, '_request_id', '') or '')[:255]
