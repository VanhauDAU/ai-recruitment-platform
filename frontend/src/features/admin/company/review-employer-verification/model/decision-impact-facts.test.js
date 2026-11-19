// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { decisionImpactFacts } from './decision-impact-facts'
import { pickNextCase } from './next-case'

describe('decisionImpactFacts', () => {
  it('summarises tax, resources and the rejection counter in one line each', () => {
    const { facts, notes } = decisionImpactFacts({
      decision: 'rejected',
      tax_advisory: { status: 'mismatch' },
      resources: { campaign_count: 2, job_count: 5, active_jobs_hidden_from_public: 3 },
      rejection_impact: { next_count: 3, limit: 3, will_lock_resubmission: true },
    })
    expect(facts).toEqual([
      { label: 'Mã số thuế', value: 'Không khớp', tone: 'warning' },
      { label: 'Chiến dịch', value: 2 },
      { label: 'Tin tuyển dụng', value: 5 },
      { label: 'Tin bị ẩn khỏi trang công khai', value: 3, tone: 'warning' },
      { label: 'Lượt từ chối', value: '3/3', tone: 'danger' },
    ])
    expect(notes).toHaveLength(2)
  })

  it('returns nothing before the preview arrives', () => {
    expect(decisionImpactFacts(null)).toEqual({ facts: [], notes: [] })
  })
})

describe('pickNextCase', () => {
  it('skips the current case and counts what is left', () => {
    const page = { count: 3, results: [{ public_id: 'cur' }, { public_id: 'next' }] }
    expect(pickNextCase(page, 'cur')).toEqual({ next: { public_id: 'next' }, remaining: 2 })
    expect(pickNextCase({ count: 0, results: [] }, 'cur')).toEqual({ next: null, remaining: 0 })
  })
})
