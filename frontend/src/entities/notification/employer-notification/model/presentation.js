const EVENT_TONES = {
  verification_approved: 'success',
  verification_changes_requested: 'warning',
  verification_rejected: 'danger',
  verification_revoked: 'danger',
  verification_expired: 'warning',
  document_changes_requested: 'warning',
  document_rejected: 'danger',
  company_link_removed: 'info',
}

export function employerNotificationTone(eventType) {
  return EVENT_TONES[eventType] || 'info'
}
