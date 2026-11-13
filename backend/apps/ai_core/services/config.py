"""Runtime configuration resolved from Django settings, never from domain tables."""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass, replace
from decimal import Decimal, InvalidOperation
from typing import Any

from django.conf import settings

from .contracts import AiGenerationError

DEFAULT_MODEL = 'gemini-3.5-flash-lite'
GEMINI_DEVELOPER = 'gemini_developer'
VERTEX = 'vertex'
SUPPORTED_PROVIDER_BACKENDS = frozenset({GEMINI_DEVELOPER, VERTEX})


def _decimal(value: Any) -> Decimal:
    try:
        result = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return Decimal('0')
    return max(result, Decimal('0'))


def _positive_int(value: Any, default: int) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return default
    return parsed if parsed > 0 else default


def _positive_float(value: Any, default: float) -> float:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return default
    return parsed if parsed > 0 else default


@dataclass(frozen=True, slots=True)
class AiRuntimeConfig:
    enabled: bool = False
    provider_backend: str = GEMINI_DEVELOPER
    model: str = DEFAULT_MODEL
    gemini_api_key: str = ''
    google_cloud_project: str = ''
    google_cloud_location: str = 'global'
    api_version: str = 'v1'
    timeout_seconds: float = 40.0
    max_attempts: int = 2
    retry_base_seconds: float = 0.5
    input_cost_per_million_usd: Decimal = Decimal('0')
    output_cost_per_million_usd: Decimal = Decimal('0')

    @classmethod
    def from_django_settings(cls, *, model: str | None = None):
        selected_model = model or getattr(settings, 'AI_JOB_GENERATION_MODEL', DEFAULT_MODEL)
        pricing = getattr(settings, 'AI_MODEL_PRICING_USD', {})
        model_pricing: Mapping[str, Any] = {}
        if isinstance(pricing, Mapping):
            candidate = pricing.get(selected_model, {})
            if isinstance(candidate, Mapping):
                model_pricing = candidate
        return cls(
            enabled=getattr(settings, 'AI_RUNTIME_ENABLED', False) is True,
            provider_backend=str(
                getattr(settings, 'AI_PROVIDER_BACKEND', GEMINI_DEVELOPER)
            ).strip(),
            model=str(selected_model or DEFAULT_MODEL).strip(),
            gemini_api_key=str(getattr(settings, 'GEMINI_API_KEY', '') or '').strip(),
            google_cloud_project=str(getattr(settings, 'GOOGLE_CLOUD_PROJECT', '') or '').strip(),
            google_cloud_location=str(
                getattr(settings, 'GOOGLE_CLOUD_LOCATION', 'global') or 'global'
            ).strip(),
            api_version=str(getattr(settings, 'AI_PROVIDER_API_VERSION', 'v1') or 'v1').strip(),
            timeout_seconds=_positive_float(
                getattr(settings, 'AI_PROVIDER_TIMEOUT_SECONDS', 40),
                40,
            ),
            max_attempts=min(
                2,
                _positive_int(getattr(settings, 'AI_PROVIDER_MAX_ATTEMPTS', 2), 2),
            ),
            retry_base_seconds=_positive_float(
                getattr(settings, 'AI_PROVIDER_RETRY_BASE_SECONDS', 0.5),
                0.5,
            ),
            input_cost_per_million_usd=_decimal(model_pricing.get('input', 0)),
            output_cost_per_million_usd=_decimal(model_pricing.get('output', 0)),
        )

    def with_model(self, model: str | None):
        return replace(self, model=model.strip()) if model and model.strip() else self

    def validate(self, *, require_credentials: bool = True):
        if not self.enabled:
            raise AiGenerationError('runtime_disabled')
        if self.provider_backend not in SUPPORTED_PROVIDER_BACKENDS:
            raise AiGenerationError('unsupported_provider_backend')
        if not self.model:
            raise AiGenerationError('model_not_configured')
        if not require_credentials:
            return
        if self.provider_backend == GEMINI_DEVELOPER and not self.gemini_api_key:
            raise AiGenerationError('provider_not_configured')
        if self.provider_backend == VERTEX and (
            not self.google_cloud_project or not self.google_cloud_location
        ):
            raise AiGenerationError('provider_not_configured')

    def cost_for(self, usage):
        million = Decimal('1000000')
        return (
            Decimal(usage.input_tokens) * self.input_cost_per_million_usd
            + Decimal(usage.output_tokens) * self.output_cost_per_million_usd
        ) / million
