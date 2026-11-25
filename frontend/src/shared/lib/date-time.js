import { getIntlLocale, m } from '@/shared/config/i18n'

function toDate(value) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

/** Múi giờ cố định cho lịch do admin đặt (thông báo đa cổng). */
export const VN_TIME_ZONE = 'Asia/Ho_Chi_Minh'

/**
 * "15/11/2026, 09:30" — date and time in the UI language; `fallback` ("—") when
 * absent or unparsable. `dateStyle: 'medium'` gives "15 thg 11, 2026, 09:30".
 */
export function formatDateTime(value, { dateStyle = 'short', timeZone, fallback = '—' } = {}) {
  const date = toDate(value)
  return date
    ? new Intl.DateTimeFormat(getIntlLocale(), { dateStyle, timeStyle: 'short', timeZone }).format(date)
    : fallback
}

/** "09:30" — clock time only. */
export function formatClockTime(value) {
  const date = toDate(value)
  return date
    ? new Intl.DateTimeFormat(getIntlLocale(), { hour: '2-digit', minute: '2-digit' }).format(date)
    : '—'
}

/** "dưới 1 giờ" / "5 giờ" / "2 ngày" — how long something has been waiting. */
export function formatElapsed(from, now = Date.now()) {
  const hours = Math.max(0, (now - new Date(from).getTime()) / 36e5)
  if (hours < 1) return m.common_elapsed_under_hour()
  if (hours < 24) return m.common_elapsed_hours({ count: Math.floor(hours) })
  return m.common_elapsed_days({ count: Math.floor(hours / 24) })
}

/** "2026-11-19" in the viewer's local calendar — the key for grouping by day. */
export function localDayKey(value) {
  const date = toDate(value)
  if (!date) return ''
  const pad = (number) => String(number).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** "Hôm nay" / "Hôm qua" / "Thứ Hai, 17/11/2026" — a day heading in the local calendar. */
export function formatRelativeDay(value, now = new Date()) {
  const date = toDate(value)
  if (!date) return '—'
  const key = localDayKey(date)
  const today = new Date(now)
  if (key === localDayKey(today)) return m.common_day_today()
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1)
  if (key === localDayKey(yesterday)) return m.common_day_yesterday()
  const weekday = new Intl.DateTimeFormat(getIntlLocale(), { weekday: 'long' }).format(date)
  const day = new Intl.DateTimeFormat(getIntlLocale(), { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${day}`
}

/**
 * "5 phút trước" / "2 giờ trước" / "Hôm qua" — how long ago, in the UI language.
 * `inSentence` lowercases the first letter for use inside a sentence: Vietnamese
 * capitalizes standalone words such as "Hôm kia".
 */
export function formatTimeAgo(value, now = Date.now(), { inSentence = false } = {}) {
  const date = toDate(value)
  if (!date) return '—'
  const seconds = Math.round((date.getTime() - now) / 1000)
  const format = new Intl.RelativeTimeFormat(getIntlLocale(), { numeric: 'auto' })
  const minutes = Math.round(seconds / 60)
  const hours = Math.round(minutes / 60)
  const text = Math.abs(seconds) < 60 ? format.format(0, 'second')
    : Math.abs(minutes) < 60 ? format.format(minutes, 'minute')
      : Math.abs(hours) < 24 ? format.format(hours, 'hour')
        : format.format(Math.round(hours / 24), 'day')
  return inSentence ? text.charAt(0).toLocaleLowerCase(getIntlLocale()) + text.slice(1) : text
}
