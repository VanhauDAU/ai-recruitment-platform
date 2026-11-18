const EVENT_TONES = {
  application_shortlisted: 'success',
  application_interviewed: 'success',
  application_accepted: 'success',
  application_rejected: 'warning',
}

/** Tone of `NotificationListItem`; views and downloads stay informational. */
export function candidateNotificationTone(eventType) {
  return EVENT_TONES[eventType] || 'info'
}
