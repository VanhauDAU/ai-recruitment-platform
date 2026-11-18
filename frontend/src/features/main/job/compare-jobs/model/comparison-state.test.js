import { describe, expect, it } from 'vitest'
import {
  comparisonHasItem,
  comparisonReducer,
  sanitizeComparisonItems,
} from './comparison-state'

const jobs = [
  { public_id: 'job-1', slug: 'frontend-engineer', title: 'Frontend Engineer', company_name: 'ProCV' },
  { public_id: 'job-2', slug: 'backend-engineer', title: 'Backend Engineer', company_name: 'ProCV' },
  { public_id: 'job-3', slug: 'product-designer', title: 'Product Designer', company_name: 'ProCV' },
  { public_id: 'job-4', slug: 'data-engineer', title: 'Data Engineer', company_name: 'ProCV' },
]

describe('job comparison reducer', () => {
  it('keeps insertion order, deduplicates and never replaces an existing item when full', () => {
    let state = []
    for (const job of jobs) state = comparisonReducer(state, { type: 'add', job })
    state = comparisonReducer(state, { type: 'add', job: jobs[0] })

    expect(state.map((item) => item.slug)).toEqual([
      'frontend-engineer',
      'backend-engineer',
      'product-designer',
    ])
  })

  it('removes by public id or slug and clears all items', () => {
    const initial = sanitizeComparisonItems(jobs)
    const withoutBackend = comparisonReducer(initial, { type: 'remove', identifier: 'backend-engineer' })

    expect(comparisonHasItem(withoutBackend, 'job-2')).toBe(false)
    expect(comparisonReducer(withoutBackend, { type: 'clear' })).toEqual([])
  })

  it('rejects corrupt entries and caps restored data at three jobs', () => {
    expect(sanitizeComparisonItems([null, {}, jobs[0], jobs[0], ...jobs.slice(1)]))
      .toHaveLength(3)
  })
})
