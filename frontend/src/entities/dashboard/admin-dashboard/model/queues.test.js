import { describe, expect, it } from 'vitest'
import { buildQueues } from './queues'

const NOW = Date.parse('2026-11-16T10:00:00Z')
const hoursAgo = (hours) => new Date(NOW - hours * 36e5).toISOString()

describe('admin queue model', () => {
  it('puts overdue queues first, then the one closest to its SLA, and splits out empty queues', () => {
    const result = buildQueues([
      { key: 'company_updates', count: 2, overdue: 0, oldest_at: hoursAgo(10), sla_hours: 72 },
      { key: 'recruiter_verification', count: 4, overdue: 0, oldest_at: hoursAgo(60), sla_hours: 72 },
      { key: 'job_reports', count: 1, overdue: 1, oldest_at: hoursAgo(50), sla_hours: 48 },
      { key: 'company_reports', count: 0, overdue: 0, oldest_at: null, sla_hours: 48 },
      { key: 'unknown_queue', count: 9, overdue: 9, oldest_at: hoursAgo(1), sla_hours: 1 },
    ], NOW)

    expect(result.pending.map((item) => [item.key, item.tone])).toEqual([
      ['job_reports', 'critical'],
      ['recruiter_verification', 'warning'],
      ['company_updates', 'normal'],
    ])
    expect(result.cleared.map((item) => item.key)).toEqual(['company_reports'])
    expect(result).toMatchObject({ total: 7, overdue: 1 })
    expect(result.pending[0].to).toBe('/quan-tri/duyet-tin?tab=reports')
  })
})
