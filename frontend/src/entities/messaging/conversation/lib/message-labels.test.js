import { describe, expect, it } from 'vitest'
import { interviewStatusTag } from './message-labels'

describe('interviewStatusTag', () => {
  it('reads an accepted interview whose time is over as having taken place', () => {
    expect(interviewStatusTag('accepted')).toEqual({ label: 'Đã nhận', tone: 'accent' })
    expect(interviewStatusTag('accepted', { ended: true })).toEqual({ label: 'Đã diễn ra', tone: 'fog' })
    expect(interviewStatusTag('cancelled', { ended: true }).tone).toBe('danger')
  })
})
