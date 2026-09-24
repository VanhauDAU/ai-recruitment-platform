export const SERVICE_STATUS_META = {
  active: { color: 'blue', label: 'Đang chạy' },
  expired: { color: 'default', label: 'Đã kết thúc' },
  terminated: { color: 'red', label: 'Đã dừng' },
}

export function formatServiceDate(value, withTime = false) {
  if (!value) return '—'
  return new Date(value).toLocaleString('vi-VN', withTime
    ? { dateStyle: 'short', timeStyle: 'short' }
    : { dateStyle: 'short' })
}

export function serviceErrorMessage(error, fallback) {
  const detail = error?.response?.data?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) return detail.join(' ')
  const blockers = error?.response?.data?.blockers
  if (Array.isArray(blockers)) return blockers.join(' ')
  return fallback
}

export function serviceActionKey(prefix) {
  return globalThis.crypto?.randomUUID?.()
    || `${prefix}-${Date.now()}-${Math.random()}`
}

export function serviceDaysRemaining(endsAt) {
  if (!endsAt) return null
  const remaining = new Date(endsAt).getTime() - Date.now()
  return Math.max(0, Math.ceil(remaining / 86400000))
}
