import { describe, expect, it } from 'vitest'
import { buildQueues, formatAge, greeting, periodChange } from './dashboard-model'

const NOW = Date.parse('2026-11-16T10:00:00Z')
const hoursAgo = (hours) => new Date(NOW - hours * 36e5).toISOString()

describe('admin dashboard model', () => {
  it('puts overdue queues first, then the one closest to its SLA, and splits out empty queues', () => {
    const result = buildQueues([
      { key: 'company_updates', count: 2, overdue: 0, oldest_at: hoursAgo(10), sla_hours: 72 },
      { key: 'recruiter_verification', count: 4, overdue: 0, oldest_at: hoursAgo(60), sla_hours: 72 },
      { key: 'job_reports', count: 1, overdue: 1, oldest_at: hoursAgo(50), sla_hours: 48 },
      { key: 'blog_reviews', count: 0, overdue: 0, oldest_at: null, sla_hours: 72 },
      { key: 'unknown_queue', count: 9, overdue: 9, oldest_at: hoursAgo(1), sla_hours: 1 },
    ], NOW)

    expect(result.pending.map((item) => [item.key, item.tone])).toEqual([
      ['job_reports', 'critical'],
      ['recruiter_verification', 'warning'],
      ['company_updates', 'normal'],
    ])
    expect(result.cleared.map((item) => item.key)).toEqual(['blog_reviews'])
    expect(result).toMatchObject({ total: 7, overdue: 1 })
    expect(result.pending[0].to).toBe('/admin/app/job-moderation?tab=reports')
  })

  it('reports period change and has no base for brand new activity', () => {
    expect(periodChange({ current: 12, previous: 10 })).toBeCloseTo(0.2)
    expect(periodChange({ current: 5, previous: 0 })).toBeNull()
    expect(periodChange({ current: 0, previous: 0 })).toBe(0)
  })

  it('formats waiting time and greets by time of day', () => {
    expect(formatAge(hoursAgo(0.5), NOW)).toBe('dưới 1 giờ')
    expect(formatAge(hoursAgo(5), NOW)).toBe('5 giờ')
    expect(formatAge(hoursAgo(50), NOW)).toBe('2 ngày')
    expect(greeting(new Date(2026, 10, 16, 8))).toBe('Chào buổi sáng')
    expect(greeting(new Date(2026, 10, 16, 20))).toBe('Chào buổi tối')
  })
})
