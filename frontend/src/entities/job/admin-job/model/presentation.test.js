import { describe, expect, it } from 'vitest'
import { formatAdminJobDate, formatAdminJobDateTime } from './presentation'

describe('admin job date presentation', () => {
  it('formats an instant explicitly in Vietnam time', () => {
    expect(formatAdminJobDateTime('2026-08-12T01:05:00Z')).toBe(
      '12/08/2026 · 08:05',
    )
  })

  it('keeps date-only values stable and handles invalid data', () => {
    expect(formatAdminJobDate('2026-08-12')).toBe('12/08/2026')
    expect(formatAdminJobDateTime('not-a-date')).toBe('—')
    expect(formatAdminJobDate(null)).toBe('—')
  })
})
