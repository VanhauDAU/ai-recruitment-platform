function toDate(value) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

/** "15/11/2026, 09:30" — short Vietnamese date and time; "—" when absent. */
export function formatDateTime(value) {
  const date = toDate(value)
  return date
    ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(date)
    : '—'
}

/** "09:30" — clock time only. */
export function formatClockTime(value) {
  const date = toDate(value)
  return date
    ? new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' }).format(date)
    : '—'
}
