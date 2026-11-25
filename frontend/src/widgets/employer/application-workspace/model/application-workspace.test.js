// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  groupApplicationsByCandidate,
  initialsOf,
  pendingNoticeOf,
} from './application-workspace'

describe('application workspace model', () => {
  it('groups candidate emails case-insensitively and keeps the server ranking', () => {
    const groups = groupApplicationsByCandidate([
      { public_id: 'app_best', candidate_email: 'hau@example.com', applied_at: '2026-07-01' },
      { public_id: 'app_other', candidate_email: 'an@example.com', applied_at: '2026-09-01' },
      { public_id: 'app_second', candidate_email: 'HAU@example.com', applied_at: '2026-08-01' },
    ])

    expect(groups.map((group) => group.candidateEmail)).toEqual(['hau@example.com', 'an@example.com'])
    expect(groups[0].applications.map((item) => item.public_id)).toEqual(['app_best', 'app_second'])
  })

  it('exposes only the decision the recruiter can still undo', () => {
    expect(pendingNoticeOf([
      { to_status: 'viewed', can_undo: false, candidate_notice: { state: 'delivered' } },
      { to_status: 'rejected', can_undo: true, candidate_notice: { state: 'scheduled', deliver_at: '2026-11-15T10:05:00Z' } },
    ])).toEqual({ deliver_at: '2026-11-15T10:05:00Z' })
    expect(pendingNoticeOf([{ to_status: 'viewed', can_undo: false }])).toBeNull()
  })

  it('builds two-letter initials from the last words of a name', () => {
    expect(initialsOf('Lê Văn Hậu')).toBe('VH')
    expect(initialsOf('')).toBe('UV')
  })
})
