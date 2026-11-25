import { describe, expect, it } from 'vitest'
import { formatConversationTime } from './conversation-time'

describe('formatConversationTime', () => {
  const now = new Date(2026, 10, 26, 15, 0)

  it('shows the clock time today and a short date otherwise', () => {
    expect(formatConversationTime(new Date(2026, 10, 26, 9, 5).toISOString(), now)).toBe('09:05')
    expect(formatConversationTime(new Date(2026, 10, 25, 9, 5).toISOString(), now)).toBe('25/11')
    expect(formatConversationTime(new Date(2025, 0, 2).toISOString(), now)).toBe('02/01/2025')
    expect(formatConversationTime(null, now)).toBe('')
  })
})
