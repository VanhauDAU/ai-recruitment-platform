import { describe, expect, it } from 'vitest'
import { isDefaultJobListQuery, jobKeys } from './job.keys'

describe('job query keys', () => {
  it('provides one root key for invalidating every public job list', () => {
    expect(jobKeys.publicLists()).toEqual(['jobs', 'list'])
    expect(jobKeys.list({ page: 1 }).slice(0, 2)).toEqual(jobKeys.publicLists())
    expect(jobKeys.list({ page: 2 }).slice(0, 2)).toEqual(jobKeys.publicLists())
    expect(jobKeys.employerList({ page: 1 }).slice(0, 2)).not.toEqual(jobKeys.publicLists())
    expect(jobKeys.homepageBest({ page: 1 }).slice(0, 2)).not.toEqual(jobKeys.publicLists())
  })

  it('keeps the homepage rotation pool separate from main-list ranking invalidation', () => {
    expect(jobKeys.homepageBest(new URLSearchParams('page=1&rotation_seed=seed-a')))
      .toEqual(['jobs', 'homepage-best', 'page=1&rotation_seed=seed-a'])
  })

  it('uses the serialized query when list params are URLSearchParams', () => {
    const first = jobKeys.list(new URLSearchParams('page=1&category=10'))
    const second = jobKeys.list(new URLSearchParams('page=2&category=10'))

    expect(first).toEqual(['jobs', 'list', 'page=1&category=10'])
    expect(second).toEqual(['jobs', 'list', 'page=2&category=10'])
    expect(first).not.toEqual(second)
  })

  it('keeps plain-object query contracts unchanged', () => {
    const params = { category: 10, page_size: 12 }

    expect(jobKeys.list(params)).toEqual(['jobs', 'list', params])
  })

  it('matches only default-ranked public list queries', () => {
    expect(isDefaultJobListQuery({ queryKey: jobKeys.list(new URLSearchParams('page=2')) }))
      .toBe(true)
    expect(isDefaultJobListQuery({
      queryKey: jobKeys.list(new URLSearchParams('ordering=newest')),
    })).toBe(false)
    expect(isDefaultJobListQuery({ queryKey: jobKeys.list({ ordering: 'salary_desc' }) }))
      .toBe(false)
    expect(isDefaultJobListQuery({ queryKey: jobKeys.employerList() })).toBe(false)
  })
})
