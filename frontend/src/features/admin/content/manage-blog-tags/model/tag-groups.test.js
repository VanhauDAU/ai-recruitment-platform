import { describe, expect, it } from 'vitest'
import { findSimilarTagGroups } from './tag-groups'

describe('similar blog tag groups', () => {
  it('flags singular/plural and generic-prefix variants', () => {
    const groups = findSimilarTagGroups([
      { name: 'Sale' },
      { name: 'Sales' },
      { name: 'Nghề Sales' },
      { name: 'Kỹ năng bán hàng' },
    ])
    expect(groups).toHaveLength(1)
    expect(groups[0].map((tag) => tag.name)).toEqual(['Sale', 'Sales', 'Nghề Sales'])
  })
})
