"""Write workflows for the candidates domain."""

from .email_notifications import patch_candidate_email_notification_settings
from .notification_emails import email_brand_context
from .notifications import (
    cancel_candidate_notification,
    deliver_candidate_notification_email,
    emit_candidate_notification,
    mark_all_candidate_notifications_read,
    mark_candidate_notification_read,
    pending_candidate_notification_email_ids,
    purge_expired_candidate_notifications,
    release_candidate_notification,
    release_due_candidate_notifications,
    restore_superseded_candidate_notification,
)
from .profiles import (
    CONSENT_POLICY_VERSION,
    replace_candidate_job_preferences,
    set_ai_recommendation,
    set_recruiter_visibility,
    update_candidate_profile,
)

__all__ = [
    'CONSENT_POLICY_VERSION',
    'cancel_candidate_notification',
    'deliver_candidate_notification_email',
    'email_brand_context',
    'emit_candidate_notification',
    'mark_all_candidate_notifications_read',
    'mark_candidate_notification_read',
    'patch_candidate_email_notification_settings',
    'pending_candidate_notification_email_ids',
    'purge_expired_candidate_notifications',
    'release_candidate_notification',
    'release_due_candidate_notifications',
    'replace_candidate_job_preferences',
    'restore_superseded_candidate_notification',
    'set_ai_recommendation',
    'set_recruiter_visibility',
    'update_candidate_profile',
]
