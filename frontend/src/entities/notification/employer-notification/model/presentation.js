// Tone of an event for icons and badges; anything unlisted is informational.
const EVENT_TONES = {
  verification_approved: 'success',
  company_page_editor_granted: 'success',
  company_join_approved: 'success',
  campaign_activated: 'success',
  verification_changes_requested: 'warning',
  verification_expired: 'warning',
  document_changes_requested: 'warning',
  application_awaiting_reply: 'warning',
  job_changes_requested: 'warning',
  campaign_ending_soon: 'warning',
  campaign_health_alert: 'warning',
  social_connection_expiring: 'warning',
  social_post_delete_failed: 'warning',
  verification_rejected: 'danger',
  verification_revoked: 'danger',
  document_rejected: 'danger',
  company_join_rejected: 'danger',
  company_page_editor_revoked: 'danger',
  company_content_reverted: 'danger',
  campaign_activation_failed: 'danger',
  social_post_failed: 'danger',
  social_connection_expired: 'danger',
}

export function employerNotificationTone(eventType) {
  return EVENT_TONES[eventType] || 'info'
}
