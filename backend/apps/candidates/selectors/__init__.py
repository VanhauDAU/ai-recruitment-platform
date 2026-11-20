"""Read queries for the candidates domain."""

from .email_notifications import candidate_email_notification_settings_for_user
from .notifications import candidate_notification_queryset, candidate_unread_notification_count
from .profiles import (
    ai_recommendation_consent,
    candidate_job_preference_for_user,
    candidate_profile_for_user,
    recruiter_visibility_consent,
)

__all__ = [
    'candidate_email_notification_settings_for_user',
    'candidate_job_preference_for_user',
    'candidate_notification_queryset',
    'candidate_profile_for_user',
    'candidate_unread_notification_count',
    'ai_recommendation_consent',
    'recruiter_visibility_consent',
]
