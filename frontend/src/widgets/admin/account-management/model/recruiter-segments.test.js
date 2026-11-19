// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { activeRecruiterSegment, applyRecruiterSegment } from './recruiter-segments'

const base = { q: 'an', next_action: '', company_state: '', status: '', ordering: '-date_joined' }

describe('recruiter segments', () => {
  it('replaces only the segment filters and keeps the search', () => {
    const queue = applyRecruiterSegment({ ...base, status: 'active' }, 'admin_queue')
    expect(queue).toMatchObject({ q: 'an', status: '', next_action: 'admin_queue', ordering: 'next_action' })
    expect(activeRecruiterSegment(queue)).toBe('admin_queue')
  })

  it('drops the queue ordering when leaving a queue tile', () => {
    const queue = applyRecruiterSegment(base, 'overdue')
    expect(applyRecruiterSegment(queue, 'companyless')).toMatchObject({
      next_action: '',
      company_state: 'missing',
      ordering: '-date_joined',
    })
  })

  it('reports no tile for filters no tile describes', () => {
    expect(activeRecruiterSegment(base)).toBe('all')
    expect(activeRecruiterSegment({ ...base, status: 'active' })).toBe('')
  })
})
