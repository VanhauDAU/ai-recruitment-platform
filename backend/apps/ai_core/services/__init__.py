"""Public service API for all AI use cases."""

from .config import AiRuntimeConfig
from .contracts import (
    AiGenerationError,
    GenerationAttempt,
    ProviderGenerationResult,
    StructuredGenerationResult,
    StructuredOutputProvider,
    TokenUsage,
)
from .cv_import import AiCvParseError, structure_cv_text
from .runtime import generate_structured
from .usage import record_ai_quota_rejection

__all__ = [
    'AiCvParseError',
    'AiGenerationError',
    'AiRuntimeConfig',
    'GenerationAttempt',
    'ProviderGenerationResult',
    'StructuredGenerationResult',
    'StructuredOutputProvider',
    'TokenUsage',
    'generate_structured',
    'record_ai_quota_rejection',
    'structure_cv_text',
]
