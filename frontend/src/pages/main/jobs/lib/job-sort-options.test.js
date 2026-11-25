// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { JOB_SORT_OPTIONS, normalizeJobSort } from './job-sort-options'

describe('job list sort options', () => {
  it('offers newest as the default, then salary and closing soon', () => {
    expect(JOB_SORT_OPTIONS.map((option) => option.value)).toEqual(['', 'salary_desc', 'closing_soon'])
    expect(JOB_SORT_OPTIONS[0].label).toBe('Mới đăng')
  })

  it('drops retired or unknown sort values from old links', () => {
    expect(normalizeJobSort('closing_soon')).toBe('closing_soon')
    expect(normalizeJobSort('urgent')).toBe('')
    expect(normalizeJobSort('newest')).toBe('')
    expect(normalizeJobSort(null)).toBe('')
  })
})
