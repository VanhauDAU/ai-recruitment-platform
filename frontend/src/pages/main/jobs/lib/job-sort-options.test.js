import { describe, expect, it } from 'vitest'
import { JOB_SORT_OPTIONS } from './job-sort-options'

describe('job list sort options', () => {
  it('labels the ranked default neutrally and offers newest explicitly', () => {
    expect(JOB_SORT_OPTIONS).toEqual([
      { value: '', label: 'Mặc định' },
      { value: 'newest', label: 'Mới đăng' },
      { value: 'salary_desc', label: 'Lương cao nhất' },
      { value: 'urgent', label: 'Cần tuyển gấp' },
    ])
  })
})
