import { describe, expect, it } from 'vitest'
import { interviewPayload, toLocalInputValue, validateInterview } from './interview-form'

const base = { startsAt: '2026-11-27T09:00', duration: '45', mode: 'onsite', location: ' Tầng 3 ', meetingUrl: '', note: '' }
const now = new Date(2026, 10, 26, 12, 0)

describe('interview form', () => {
  it('asks for a future time and the place that fits the mode', () => {
    expect(validateInterview(base, now)).toEqual({})
    expect(validateInterview({ ...base, startsAt: '2026-11-25T09:00' }, now)).toEqual({ startsAt: 'future' })
    expect(validateInterview({ ...base, location: ' ' }, now)).toEqual({ location: 'required' })
    expect(validateInterview({ ...base, mode: 'online', meetingUrl: 'meet' }, now)).toEqual({ meetingUrl: 'invalid' })
  })

  it('sends only the field of the chosen mode', () => {
    expect(interviewPayload(base)).toMatchObject({ duration_minutes: 45, mode: 'onsite', location: 'Tầng 3', meeting_url: '' })
    expect(toLocalInputValue(new Date(2026, 0, 2, 3, 4))).toBe('2026-01-02T03:04')
  })
})
