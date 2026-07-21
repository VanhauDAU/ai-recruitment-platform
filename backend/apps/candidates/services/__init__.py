"""Write workflows for the candidates domain."""

from .profiles import (
    replace_candidate_job_preferences,
    set_recruiter_visibility,
    update_candidate_profile,
)

__all__ = [
    'replace_candidate_job_preferences',
    'set_recruiter_visibility',
    'update_candidate_profile',
]
