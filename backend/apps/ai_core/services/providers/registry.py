"""Chọn adapter theo ``AI_PROVIDER_BACKEND``."""

from ..config import ANTHROPIC, AiRuntimeConfig
from .base import RetryingStructuredOutputProvider
from .claude import ClaudeStructuredOutputProvider
from .gemini import GeminiStructuredOutputProvider


def provider_for(config: AiRuntimeConfig) -> RetryingStructuredOutputProvider:
    """anthropic là Claude; gemini_developer và vertex dùng chung adapter Gemini."""
    if config.provider_backend == ANTHROPIC:
        return ClaudeStructuredOutputProvider(config)
    return GeminiStructuredOutputProvider(config)
