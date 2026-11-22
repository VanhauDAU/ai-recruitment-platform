import { describe, expect, it } from 'vitest'
import { settledList } from './use-header-navigation-sources'

describe('settledList', () => {
  it('keeps loading apart from empty and accepts lists or paginated pages only', () => {
    expect(settledList({ data: undefined })).toBeUndefined()
    expect(settledList({ isError: true })).toEqual([])
    expect(settledList({ data: [{ id: 1 }] })).toEqual([{ id: 1 }])
    expect(settledList({ data: { results: [{ id: 2 }] } })).toEqual([{ id: 2 }])
    expect(settledList({ data: {} })).toEqual([])
    expect(settledList({ data: null })).toEqual([])
  })
})
