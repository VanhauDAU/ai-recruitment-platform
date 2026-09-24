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

export function formatEmployerEventTime(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date)
}
