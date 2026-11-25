import { formatClockTime, localDayKey } from '@/shared/lib/date-time'

const pad = (number) => String(number).padStart(2, '0')

/**
 * "09:30" today, "25/11" this year, "25/11/2025" before — the time column of a
 * list row. Dates are built from parts: ICU builds differ on the separator.
 */
export function formatConversationTime(value, now = new Date()) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  if (localDayKey(date) === localDayKey(now)) return formatClockTime(date)
  const dayMonth = `${pad(date.getDate())}/${pad(date.getMonth() + 1)}`
  return date.getFullYear() === now.getFullYear() ? dayMonth : `${dayMonth}/${date.getFullYear()}`
}
