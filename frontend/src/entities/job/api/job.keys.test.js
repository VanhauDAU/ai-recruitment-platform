import { describe, expect, it } from 'vitest'
import { jobKeys } from './job.keys'

describe('job query keys', () => {
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
})
