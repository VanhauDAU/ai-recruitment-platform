"""Google Gen AI SDK adapter shared by Gemini Developer API and Vertex AI."""

from __future__ import annotations

import json
from collections.abc import Mapping
from typing import Any

from ..config import GEMINI_DEVELOPER, AiRuntimeConfig
from ..contracts import AiGenerationError, TokenUsage
from .base import RetryingStructuredOutputProvider, _non_negative_int, _value


def _enum_value(value: Any) -> str:
    candidate = getattr(value, 'value', value)
    return str(candidate or '')[:64]


class GeminiStructuredOutputProvider(RetryingStructuredOutputProvider):
    provider_name = 'gemini'

    @staticmethod
    def _default_client(config: AiRuntimeConfig):
        # Imported lazily: the SDK is heavy and only AI workers ever build a client.
        from google import genai
        from google.genai import types

        http_options = types.HttpOptions(
            api_version=config.api_version,
            timeout=int(config.timeout_seconds * 1000),
        )
        if config.provider_backend == GEMINI_DEVELOPER:
            return genai.Client(api_key=config.gemini_api_key, http_options=http_options)
        return genai.Client(
            vertexai=True,
            project=config.google_cloud_project,
            location=config.google_cloud_location,
            http_options=http_options,
        )

    def _request(self, *, prompt, response_schema, system_instruction):
        return self.client.models.generate_content(
            model=self.model,
            contents=prompt,
            config=self._generation_config(response_schema, system_instruction),
        )

    @staticmethod
    def _generation_config(response_schema, system_instruction):
        config = {
            'temperature': 0,
            'response_mime_type': 'application/json',
            'response_json_schema': dict(response_schema),
        }
        if system_instruction:
            config['system_instruction'] = system_instruction
        return config

    @staticmethod
    def _response_data(response):
        block_reason = _value(_value(response, 'prompt_feedback'), 'block_reason')
        if block_reason:
            raise AiGenerationError('content_blocked')
        parsed = _value(response, 'parsed')
        if hasattr(parsed, 'model_dump'):
            parsed = parsed.model_dump(mode='json')
        if parsed is None:
            text = _value(response, 'text')
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
        usage = _value(response, 'usage_metadata', {}) or {}
        return TokenUsage(
            input_tokens=_non_negative_int(_value(usage, 'prompt_token_count')),
            output_tokens=_non_negative_int(_value(usage, 'candidates_token_count')),
            total_tokens=_non_negative_int(_value(usage, 'total_token_count')),
            cached_tokens=_non_negative_int(_value(usage, 'cached_content_token_count')),
        )

    @staticmethod
    def _finish_reason(response):
        candidates = _value(response, 'candidates', []) or []
        return _enum_value(_value(candidates[0], 'finish_reason')) if candidates else ''

    @staticmethod
    def _provider_request_id(response):
        sdk_response = _value(response, 'sdk_http_response')
        headers = _value(sdk_response, 'headers', {}) or {}
        if not isinstance(headers, Mapping):
            return ''
        for key in ('x-request-id', 'x-goog-request-id'):
            if headers.get(key):
                return str(headers[key])[:255]
        return ''
