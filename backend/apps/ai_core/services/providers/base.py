"""Retry loop and error normalization shared by every structured-output provider.

A subclass only knows its SDK: how to build the client, send one request and
read data, usage and metadata off the response. Retry policy, attempt records
and privacy-safe errors (no provider text, no prompt) live here once.
"""

from __future__ import annotations

import time
from collections.abc import Callable, Mapping
from typing import Any

from ..config import AiRuntimeConfig
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


def _status_code(error) -> int | None:
    status_code = _value(error, 'status_code') or _value(error, 'code')
    if not isinstance(status_code, int):
        status_code = _value(_value(error, 'response'), 'status_code')
    return status_code if isinstance(status_code, int) else None


class RetryingStructuredOutputProvider:
    provider_name = ''

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

    # ---- SDK-specific hooks ----

    @staticmethod
    def _default_client(config: AiRuntimeConfig):
        raise NotImplementedError

    def _request(self, *, prompt, response_schema, system_instruction):
        raise NotImplementedError

    @staticmethod
    def _response_data(response) -> dict:
        raise NotImplementedError

    @staticmethod
    def _usage(response) -> TokenUsage:
        raise NotImplementedError

    @staticmethod
    def _finish_reason(response) -> str:
        return ''

    @staticmethod
    def _provider_request_id(response) -> str:
        return ''

    # ---- shared ----

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
                response = self._request(
                    prompt=prompt,
                    response_schema=response_schema,
                    system_instruction=system_instruction,
                )
                data = self._response_data(response)
                if result_validator is not None:
                    result_validator(data)
            except Exception as error:  # noqa: BLE001 - normalized without provider text
                if response is not None:
                    total_usage = self._combined_usage(total_usage, self._usage(response))
                normalized = self._normalize_error(error)
                attempts.append(
                    GenerationAttempt(
                        number=attempt_number,
                        status='failed',
                        latency_ms=self._duration_ms(started),
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
        raise AssertionError('Provider retry loop ended without a result.')

    @staticmethod
    def _combined_usage(left, right):
        return TokenUsage(
            input_tokens=left.input_tokens + right.input_tokens,
            output_tokens=left.output_tokens + right.output_tokens,
            total_tokens=left.total_tokens + right.total_tokens,
            cached_tokens=left.cached_tokens + right.cached_tokens,
        )

    def _duration_ms(self, started):
        return max(0, int((self._monotonic() - started) * 1000))

    @staticmethod
    def _normalize_error(error):
        if isinstance(error, AiGenerationError):
            return error
        class_name = type(error).__name__.lower()
        status_code = _status_code(error)

        if isinstance(error, TimeoutError) or 'timeout' in class_name:
            return AiGenerationError('provider_timeout', retryable=True, status_code=status_code)
        if status_code in {401, 403}:
            return AiGenerationError('provider_authentication_failed', status_code=status_code)
        if status_code == 402:
            # Hết credit/chưa thanh toán: thử lại vô ích, tính năng chuyển sang dự phòng.
            return AiGenerationError('provider_quota_exhausted', status_code=status_code)
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
        if 'connection' in class_name:
            return AiGenerationError('provider_unavailable', retryable=True)
        return AiGenerationError('provider_failed')
