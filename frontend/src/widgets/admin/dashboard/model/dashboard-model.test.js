import { describe, expect, it } from 'vitest'
import { greeting, periodChange } from './dashboard-model'

describe('admin dashboard model', () => {
  it('reports period change and has no base for brand new activity', () => {
    expect(periodChange({ current: 12, previous: 10 })).toBeCloseTo(0.2)
    expect(periodChange({ current: 5, previous: 0 })).toBeNull()
    expect(periodChange({ current: 0, previous: 0 })).toBe(0)
  })

  it('greets by time of day', () => {
    expect(greeting(new Date(2026, 10, 16, 8))).toBe('Chào buổi sáng')
    expect(greeting(new Date(2026, 10, 16, 20))).toBe('Chào buổi tối')
  })
})
