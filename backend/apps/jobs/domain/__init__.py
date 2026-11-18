"""Định nghĩa thuần của jobs mà cả services lẫn selectors cùng dùng."""

from .ai_policy import JOB_AI_POLICY_KEYS, JobAiPolicy, resolve_job_ai_policy

__all__ = ['JOB_AI_POLICY_KEYS', 'JobAiPolicy', 'resolve_job_ai_policy']
