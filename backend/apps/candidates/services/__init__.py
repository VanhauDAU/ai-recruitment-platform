"""Write workflows for the candidates domain."""

from .email_notifications import patch_candidate_email_notification_settings
from .profiles import (
    replace_candidate_job_preferences,
    set_recruiter_visibility,
    update_candidate_profile,
)

__all__ = [
    'patch_candidate_email_notification_settings',
    'replace_candidate_job_preferences',
    'set_recruiter_visibility',
    'update_candidate_profile',
]
