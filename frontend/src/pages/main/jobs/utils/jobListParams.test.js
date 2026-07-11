import { describe, expect, it } from 'vitest'
import {
  mergeSearchParams,
  removeSearchParams,
  replaceCommaParam,
  replaceLocationParams,
  toApiParams,
} from './jobListParams'

describe('job list search params', () => {
  it('merges values, removes empty values and resets pagination', () => {
    const current = new URLSearchParams('search=dev&page=3&sort=salary_desc')
    const next = mergeSearchParams(current, { search: '', sort: 'newest' })

    expect(next.toString()).toBe('sort=newest')
    expect(current.toString()).toBe('search=dev&page=3&sort=salary_desc')
  })

  it('stores multi-select filters as comma-separated URL values', () => {
    const current = new URLSearchParams('cat=1&page=2')
    expect(replaceCommaParam(current, 'cat', [2, 3]).toString()).toBe('cat=2%2C3')
    expect(replaceCommaParam(current, 'cat', []).toString()).toBe('')
  })

  it('normalizes location params while retaining the active keyword', () => {
    const current = new URLSearchParams('location=1&locations=2,3&page=4&search_by=title')
    const next = replaceLocationParams(current, [8, 9], {
      keyword: 'designer',
      searchBy: 'title',
    })

    expect(next.toString()).toBe('locations=8%2C9&search=designer')
  })

  it('removes only the requested keys', () => {
    const current = new URLSearchParams('search=dev&cat=1&page=2')
    expect(removeSearchParams(current, ['cat', 'page']).toString()).toBe('search=dev')
  })

  it('maps compact public URL filters to backend API params', () => {
    const current = new URLSearchParams(
      'search=dev&cat=1,2&exp=none,one&locations=10,11&salary=10-15&sort=salary_desc',
    )
    const api = toApiParams(current)

    expect(api.get('search')).toBe('dev')
    expect(api.getAll('category')).toEqual(['1', '2'])
    expect(api.getAll('experience_years')).toEqual(['none', 'one'])
    expect(api.getAll('location')).toEqual(['10', '11'])
    expect(api.get('salary_gte')).toBe('10000000')
    expect(api.get('salary_lte')).toBe('15000000')
    expect(api.get('ordering')).toBe('salary_desc')
  })
})
