import { getIntlLocale, getLocale } from '@/shared/config/i18n'
import { formatClockTime } from '@/shared/lib/date-time'

/** Weekday / day / month for the calendar stub of an interview card ("Th 5", 27, "Th11"). */
export function interviewDateParts(value, locale = getLocale()) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return { weekday: '', day: '', month: '' }
  return {
    weekday: new Intl.DateTimeFormat(getIntlLocale(), { weekday: 'short' }).format(date),
    day: date.getDate(),
    month: locale === 'vi'
      ? `Th${date.getMonth() + 1}`
      : new Intl.DateTimeFormat(getIntlLocale(), { month: 'short' }).format(date),
  }
}

/** "09:00 – 09:45" from the start time and the duration in minutes. */
export function interviewTimeRange(value, minutes = 0) {
  const start = new Date(value)
  if (Number.isNaN(start.getTime())) return ''
  const end = new Date(start.getTime() + (Number(minutes) || 0) * 60_000)
  return `${formatClockTime(start)} – ${formatClockTime(end)}`
}
