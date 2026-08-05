import { describe, expect, it } from 'vitest'
import {
  availableStatusOptions,
  groupApplicationsByCandidate,
} from './application-workspace'

const STATUSES = [
  ['submitted', 'Tiếp nhận'],
  ['viewed', 'Đã xem'],
  ['accepted', 'Đã nhận offer'],
  ['rejected', 'Từ chối'],
]

describe('application workspace model', () => {
  it('groups candidate emails case-insensitively and keeps newest CV first', () => {
    const groups = groupApplicationsByCandidate([
      { public_id: 'app_old', candidate_email: 'hau@example.com', applied_at: '2026-07-01' },
      { public_id: 'app_new', candidate_email: 'HAU@example.com', applied_at: '2026-08-01' },
    ])

    expect(groups).toHaveLength(1)
    expect(groups[0].applications.map((item) => item.public_id)).toEqual(['app_new', 'app_old'])
  })

  it('never offers an illegal transition for a restricted or terminal application', () => {
    expect(availableStatusOptions('viewed', true, STATUSES).map(([value]) => value)).toEqual([
      'viewed', 'rejected',
    ])
    expect(availableStatusOptions('accepted', true, STATUSES).map(([value]) => value)).toEqual([
      'accepted',
    ])
  })
})
