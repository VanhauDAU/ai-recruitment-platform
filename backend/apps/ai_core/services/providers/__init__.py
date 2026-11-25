"""Provider adapters owned by the shared AI runtime."""

from .base import RetryingStructuredOutputProvider
from .claude import ClaudeStructuredOutputProvider
from .gemini import GeminiStructuredOutputProvider
from .registry import provider_for

__all__ = [
    'ClaudeStructuredOutputProvider',
    'GeminiStructuredOutputProvider',
    'RetryingStructuredOutputProvider',
    'provider_for',
]
