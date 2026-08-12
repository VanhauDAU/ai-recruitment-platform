"""Stable provider-neutral contracts for structured AI generation."""

from __future__ import annotations

from collections.abc import Callable, Mapping
from dataclasses import dataclass, field
from decimal import Decimal
from typing import Any, Protocol, runtime_checkable


@dataclass(frozen=True, slots=True)
class TokenUsage:
    input_tokens: int = 0
    output_tokens: int = 0
    total_tokens: int = 0
    cached_tokens: int = 0

    def __post_init__(self):
        for value in (
            self.input_tokens,
            self.output_tokens,
            self.total_tokens,
            self.cached_tokens,
        ):
            if isinstance(value, bool) or not isinstance(value, int) or value < 0:
                raise ValueError('Token counts must be non-negative integers.')


@dataclass(frozen=True, slots=True)
class GenerationAttempt:
    number: int
    status: str
    latency_ms: int
    error_code: str = ''
    retryable: bool = False


@dataclass(frozen=True, slots=True)
class ProviderGenerationResult:
    data: dict[str, Any]
    usage: TokenUsage = field(default_factory=TokenUsage)
    attempts: tuple[GenerationAttempt, ...] = ()
    provider_request_id: str = ''
    finish_reason: str = ''


@dataclass(frozen=True, slots=True)
class StructuredGenerationResult:
    data: dict[str, Any]
    invocation_id: int
    correlation_key: str
    provider: str
    provider_backend: str
    model: str
    usage: TokenUsage
    cost_usd: Decimal
    latency_ms: int
    attempts: tuple[GenerationAttempt, ...]
    provider_request_id: str = ''
    finish_reason: str = ''


class AiGenerationError(RuntimeError):
    """Safe normalized error which never embeds provider text or prompt data."""

    def __init__(
        self,
        code: str,
        *,
        retryable: bool = False,
        status_code: int | None = None,
        attempts: tuple[GenerationAttempt, ...] = (),
        invocation_id: int | None = None,
        correlation_key: str = '',
    ):
        self.code = code
        self.retryable = retryable
        self.status_code = status_code
        self.attempts = attempts
        self.invocation_id = invocation_id
        self.correlation_key = correlation_key
        super().__init__(code)

    def with_invocation(self, *, invocation_id: int, correlation_key: str):
        return type(self)(
            self.code,
            retryable=self.retryable,
            status_code=self.status_code,
            attempts=self.attempts,
            invocation_id=invocation_id,
            correlation_key=correlation_key,
        )


@runtime_checkable
class StructuredOutputProvider(Protocol):
    provider_name: str
    provider_backend: str
    model: str

    def generate_structured(
        self,
        *,
        prompt: str,
        response_schema: Mapping[str, Any],
        system_instruction: str = '',
        result_validator: Callable[[Mapping[str, Any]], None] | None = None,
    ) -> ProviderGenerationResult: ...
