import { describe, expect, it } from 'vitest'
import { interviewDateParts, interviewTimeRange } from './interview-date'

describe('interview card dates', () => {
  it('splits the start into the calendar stub parts', () => {
    const parts = interviewDateParts(new Date(2026, 10, 27, 9, 0).toISOString(), 'vi')
    expect(parts.day).toBe(27)
    expect(parts.month).toBe('Th11')
    expect(parts.weekday).toBeTruthy()
  })

  it('shows the time range from the duration', () => {
    expect(interviewTimeRange(new Date(2026, 10, 27, 9, 0).toISOString(), 45)).toBe('09:00 – 09:45')
    expect(interviewTimeRange('not a date', 30)).toBe('')
  })
})
