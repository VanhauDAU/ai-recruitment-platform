"""Provider-neutral orchestration with privacy-safe durable observability."""

from __future__ import annotations

import hashlib
import json
import time
from collections.abc import Callable, Mapping
from contextlib import suppress
from dataclasses import replace
from typing import Any

from django.utils import timezone

from ..models import AiInvocation
from .config import AiRuntimeConfig
from .contracts import (
    AiGenerationError,
    StructuredGenerationResult,
    StructuredOutputProvider,
    TokenUsage,
)
from .providers import GeminiStructuredOutputProvider
from .usage import record_ai_usage


def _sha256(value: str) -> str:
    return hashlib.sha256(value.encode('utf-8')).hexdigest()


def _schema_sha256(schema: Mapping[str, Any]) -> str:
    try:
        encoded = json.dumps(
            schema,
            ensure_ascii=False,
            sort_keys=True,
            separators=(',', ':'),
        )
    except (TypeError, ValueError):
        raise AiGenerationError('invalid_response_schema') from None
    return _sha256(encoded)


def _validate_metadata(value, *, field, max_length):
    if not isinstance(value, str) or not value.strip() or len(value.strip()) > max_length:
        raise AiGenerationError(f'invalid_{field}')
    return value.strip()


def _attempt_latency(attempts, fallback):
    measured = sum(max(0, attempt.latency_ms) for attempt in attempts)
    return measured or max(0, fallback)


def _finalize_failure(invocation, error, latency_ms):
    attempt_count = len(error.attempts)
    invocation.status = AiInvocation.Status.FAILED
    invocation.attempt_count = attempt_count
    invocation.retry_count = max(0, attempt_count - 1)
    invocation.latency_ms = latency_ms
    invocation.error_code = error.code
    invocation.completed_at = timezone.now()
    invocation.save(
        update_fields=[
            'status',
            'attempt_count',
            'retry_count',
            'latency_ms',
            'error_code',
            'completed_at',
        ]
    )
    record_ai_usage(
        use_case=invocation.use_case,
        provider=invocation.provider,
        provider_backend=invocation.provider_backend,
        model=invocation.model,
        succeeded=False,
        retry_count=invocation.retry_count,
        usage=TokenUsage(),
        cost_usd=0,
        latency_ms=latency_ms,
    )


def generate_structured(
    *,
    use_case: str,
    prompt: str,
    response_schema: Mapping[str, Any],
    prompt_version: str,
    schema_version: str,
    system_instruction: str = '',
    result_validator: Callable[[Mapping[str, Any]], None] | None = None,
    model: str | None = None,
    correlation_key: str = '',
    runtime_config: AiRuntimeConfig | None = None,
    provider: StructuredOutputProvider | None = None,
) -> StructuredGenerationResult:
    """Generate one JSON object and durably record only privacy-safe metadata."""

    use_case = _validate_metadata(use_case, field='use_case', max_length=64)
    prompt_version = _validate_metadata(prompt_version, field='prompt_version', max_length=64)
    schema_version = _validate_metadata(schema_version, field='schema_version', max_length=64)
    if not isinstance(prompt, str) or not prompt.strip():
        raise AiGenerationError('invalid_prompt')
    if not isinstance(correlation_key, str) or len(correlation_key) > 128:
        raise AiGenerationError('invalid_correlation_key')
    if not isinstance(system_instruction, str):
        raise AiGenerationError('invalid_system_instruction')
    if result_validator is not None and not callable(result_validator):
        raise AiGenerationError('invalid_result_validator')

    config = runtime_config or AiRuntimeConfig.from_django_settings(model=model)
    if runtime_config is not None and model:
        config = replace(config, model=model.strip())
    config.validate(require_credentials=provider is None)
    owns_provider = provider is None
    selected_provider = provider or GeminiStructuredOutputProvider(config)
    if not isinstance(selected_provider, StructuredOutputProvider):
        raise AiGenerationError('invalid_provider')

    invocation = AiInvocation.objects.create(
        use_case=use_case,
        correlation_key=correlation_key,
        provider=selected_provider.provider_name,
        provider_backend=selected_provider.provider_backend,
        model=selected_provider.model,
        prompt_version=prompt_version,
        schema_version=schema_version,
        prompt_sha256=_sha256(prompt),
        schema_sha256=_schema_sha256(response_schema),
    )
    started = time.monotonic()
    try:
        provider_result = selected_provider.generate_structured(
            prompt=prompt,
            response_schema=response_schema,
            system_instruction=system_instruction,
            result_validator=result_validator,
        )
    except AiGenerationError as error:
        fallback_latency = int((time.monotonic() - started) * 1000)
        latency_ms = _attempt_latency(error.attempts, fallback_latency)
        _finalize_failure(invocation, error, latency_ms)
        raise error.with_invocation(
            invocation_id=invocation.pk,
            correlation_key=correlation_key,
        ) from None
    except Exception:  # noqa: BLE001 - callers receive no provider/PII-bearing message
        fallback_latency = int((time.monotonic() - started) * 1000)
        error = AiGenerationError('provider_failed')
        _finalize_failure(invocation, error, fallback_latency)
        raise error.with_invocation(
            invocation_id=invocation.pk,
            correlation_key=correlation_key,
        ) from None
    finally:
        if owns_provider:
            close = getattr(selected_provider, 'close', None)
            if callable(close):
                with suppress(Exception):
                    close()

    latency_ms = _attempt_latency(
        provider_result.attempts,
        int((time.monotonic() - started) * 1000),
    )
    attempt_count = len(provider_result.attempts) or 1
    retry_count = max(0, attempt_count - 1)
    cost_usd = config.cost_for(provider_result.usage)
    invocation.status = AiInvocation.Status.SUCCEEDED
    invocation.attempt_count = attempt_count
    invocation.retry_count = retry_count
    invocation.input_tokens = provider_result.usage.input_tokens
    invocation.output_tokens = provider_result.usage.output_tokens
    invocation.total_tokens = provider_result.usage.total_tokens
    invocation.cached_tokens = provider_result.usage.cached_tokens
    invocation.cost_usd = cost_usd
    invocation.latency_ms = latency_ms
    invocation.provider_request_id = provider_result.provider_request_id
    invocation.finish_reason = provider_result.finish_reason
    invocation.completed_at = timezone.now()
    invocation.save(
        update_fields=[
            'status',
            'attempt_count',
            'retry_count',
            'input_tokens',
            'output_tokens',
            'total_tokens',
            'cached_tokens',
            'cost_usd',
            'latency_ms',
            'provider_request_id',
            'finish_reason',
            'completed_at',
        ]
    )
    record_ai_usage(
        use_case=use_case,
        provider=invocation.provider,
        provider_backend=invocation.provider_backend,
        model=invocation.model,
        succeeded=True,
        retry_count=retry_count,
        usage=provider_result.usage,
        cost_usd=cost_usd,
        latency_ms=latency_ms,
    )
    return StructuredGenerationResult(
        data=provider_result.data,
        invocation_id=invocation.pk,
        correlation_key=correlation_key,
        provider=invocation.provider,
        provider_backend=invocation.provider_backend,
        model=invocation.model,
        usage=provider_result.usage,
        cost_usd=cost_usd,
        latency_ms=latency_ms,
        attempts=provider_result.attempts,
        provider_request_id=provider_result.provider_request_id,
        finish_reason=provider_result.finish_reason,
    )
