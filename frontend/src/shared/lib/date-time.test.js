// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { formatElapsed, formatRelativeDay, localDayKey } from './date-time'

// Local-calendar dates so the assertions hold in any test machine time zone.
const NOW = new Date(2026, 10, 19, 10, 0)

describe('date-time helpers', () => {
  it('formats waiting time', () => {
    const hoursAgo = (hours) => new Date(NOW.getTime() - hours * 36e5).toISOString()
    expect(formatElapsed(hoursAgo(0.5), NOW.getTime())).toBe('dưới 1 giờ')
    expect(formatElapsed(hoursAgo(5), NOW.getTime())).toBe('5 giờ')
    expect(formatElapsed(hoursAgo(50), NOW.getTime())).toBe('2 ngày')
  })

  it('keys and labels days in the local calendar', () => {
    expect(localDayKey(new Date(2026, 10, 19, 0, 5))).toBe('2026-11-19')
    expect(localDayKey(null)).toBe('')
    expect(formatRelativeDay(new Date(2026, 10, 19, 0, 1), NOW)).toBe('Hôm nay')
    expect(formatRelativeDay(new Date(2026, 10, 18, 23, 59), NOW)).toBe('Hôm qua')
    expect(formatRelativeDay(new Date(2026, 10, 16, 9, 0), NOW)).toBe('Thứ Hai, 16/11/2026')
  })
})
