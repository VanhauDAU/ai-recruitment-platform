"""Google Gen AI SDK adapter shared by Gemini Developer API and Vertex AI."""

from __future__ import annotations

import json
import time
from collections.abc import Callable, Mapping
from typing import Any

from ..config import GEMINI_DEVELOPER, AiRuntimeConfig
from ..contracts import (
    AiGenerationError,
    GenerationAttempt,
    ProviderGenerationResult,
    TokenUsage,
)


def _value(source: Any, key: str, default=None):
    if isinstance(source, Mapping):
        return source.get(key, default)
    return getattr(source, key, default)


def _non_negative_int(value: Any) -> int:
    if isinstance(value, bool):
        return 0
    try:
        return max(0, int(value or 0))
    except (TypeError, ValueError):
        return 0


def _enum_value(value: Any) -> str:
    candidate = getattr(value, 'value', value)
    return str(candidate or '')[:64]


class GeminiStructuredOutputProvider:
    provider_name = 'gemini'

    def __init__(
        self,
        config: AiRuntimeConfig,
        *,
        client=None,
        client_factory: Callable[[AiRuntimeConfig], Any] | None = None,
        sleep: Callable[[float], None] = time.sleep,
        monotonic: Callable[[], float] = time.monotonic,
    ):
        config.validate(require_credentials=client is None and client_factory is None)
        self.config = config
        self.provider_backend = config.provider_backend
        self.model = config.model
        self._client = client
        self._client_factory = client_factory or self._default_client
        self._sleep = sleep
        self._monotonic = monotonic

    @staticmethod
    def _default_client(config: AiRuntimeConfig):
        try:
            from google import genai
            from google.genai import types
        except ImportError:
            raise AiGenerationError('provider_sdk_unavailable') from None

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

    @property
    def client(self):
        if self._client is None:
            self._client = self._client_factory(self.config)
        return self._client

    def close(self):
        close = getattr(self._client, 'close', None)
        if callable(close):
            close()

    def generate_structured(
        self,
        *,
        prompt: str,
        response_schema: Mapping[str, Any],
        system_instruction: str = '',
        result_validator: Callable[[Mapping[str, Any]], None] | None = None,
    ) -> ProviderGenerationResult:
        if not isinstance(prompt, str) or not prompt.strip():
            raise AiGenerationError('invalid_prompt')
        if not isinstance(response_schema, Mapping) or not response_schema:
            raise AiGenerationError('invalid_response_schema')

        attempts: list[GenerationAttempt] = []
        total_usage = TokenUsage()
        for attempt_number in range(1, self.config.max_attempts + 1):
            started = self._monotonic()
            response = None
            try:
                response = self.client.models.generate_content(
                    model=self.model,
                    contents=prompt,
                    config=self._generation_config(response_schema, system_instruction),
                )
                data = self._response_data(response)
                if result_validator is not None:
                    result_validator(data)
            except Exception as error:  # noqa: BLE001 - normalized without provider text
                if response is not None:
                    total_usage = self._combined_usage(total_usage, self._usage(response))
                normalized = self._normalize_error(error)
                duration = self._duration_ms(started)
                attempts.append(
                    GenerationAttempt(
                        number=attempt_number,
                        status='failed',
                        latency_ms=duration,
                        error_code=normalized.code,
                        retryable=normalized.retryable,
                    )
                )
                if not normalized.retryable or attempt_number >= self.config.max_attempts:
                    raise AiGenerationError(
                        normalized.code,
                        retryable=normalized.retryable,
                        status_code=normalized.status_code,
                        attempts=tuple(attempts),
                    ) from None
                self._sleep(self.config.retry_base_seconds * (2 ** (attempt_number - 1)))
                continue

            attempts.append(
                GenerationAttempt(
                    number=attempt_number,
                    status='succeeded',
                    latency_ms=self._duration_ms(started),
                )
            )
            total_usage = self._combined_usage(total_usage, self._usage(response))
            return ProviderGenerationResult(
                data=data,
                usage=total_usage,
                attempts=tuple(attempts),
                provider_request_id=self._provider_request_id(response),
                finish_reason=self._finish_reason(response),
            )
        raise AssertionError('Gemini retry loop ended without a result.')

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
    def _combined_usage(left, right):
        return TokenUsage(
            input_tokens=left.input_tokens + right.input_tokens,
            output_tokens=left.output_tokens + right.output_tokens,
            total_tokens=left.total_tokens + right.total_tokens,
            cached_tokens=left.cached_tokens + right.cached_tokens,
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

    def _duration_ms(self, started):
        return max(0, int((self._monotonic() - started) * 1000))

    @staticmethod
    def _normalize_error(error):
        if isinstance(error, AiGenerationError):
            return error
        class_name = type(error).__name__.lower()
        status_code = _value(error, 'status_code') or _value(error, 'code')
        if not isinstance(status_code, int):
            response = _value(error, 'response')
            status_code = _value(response, 'status_code')
        if not isinstance(status_code, int):
            status_code = None

        if isinstance(error, TimeoutError) or 'timeout' in class_name:
            return AiGenerationError('provider_timeout', retryable=True, status_code=status_code)
        if status_code in {401, 403}:
            return AiGenerationError('provider_authentication_failed', status_code=status_code)
        if status_code == 404:
            return AiGenerationError('model_not_found', status_code=status_code)
        if status_code == 429:
            return AiGenerationError('rate_limited', retryable=True, status_code=status_code)
        if status_code in {408, 409, 425} or (status_code is not None and status_code >= 500):
            return AiGenerationError(
                'provider_unavailable', retryable=True, status_code=status_code
            )
        if status_code is not None and 400 <= status_code < 500:
            return AiGenerationError('invalid_provider_request', status_code=status_code)
        return AiGenerationError('provider_failed')
