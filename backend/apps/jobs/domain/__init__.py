"""Định nghĩa thuần của jobs mà cả services lẫn selectors cùng dùng."""

from .ai_policy import JOB_AI_POLICY_KEYS, JobAiPolicy, resolve_job_ai_policy
from .listing import (
    CLOSING_SOON_DEFAULT_DAYS,
    CLOSING_SOON_MAX_DAYS,
    MAX_LISTING_DAYS,
    job_presentation,
)

__all__ = [
    'CLOSING_SOON_DEFAULT_DAYS',
    'CLOSING_SOON_MAX_DAYS',
    'JOB_AI_POLICY_KEYS',
    'MAX_LISTING_DAYS',
    'JobAiPolicy',
    'job_presentation',
    'resolve_job_ai_policy',
]
