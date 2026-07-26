import { describe, expect, it } from 'vitest'
import { findMatchingTags, hasExactTag, normalizeTagName } from './tag-options'

const tags = [
  { public_id: 'ptag_sales', name: 'Sales', slug: 'sales' },
  { public_id: 'ptag_business', name: 'Nhân viên kinh doanh', slug: 'nhan-vien-kinh-doanh' },
  { public_id: 'ptag_experience', name: 'Kinh nghiệm Sales', slug: 'kinh-nghiem-sales' },
]

describe('blog tag picker options', () => {
  it('normalizes quick-created names while preserving common acronyms', () => {
    expect(normalizeTagName('nghề sales')).toBe('Nghề Sales')
    expect(normalizeTagName('mẫu cv cho it')).toBe('Mẫu CV cho IT')
  })

  it('expands Sales into related kinh doanh suggestions', () => {
    expect(findMatchingTags(tags, 'nghề sales').map((tag) => tag.public_id)).toEqual([
      'ptag_sales',
      'ptag_business',
      'ptag_experience',
    ])
  })

  it('does not offer quick create for an exact existing tag', () => {
    expect(hasExactTag(tags, 'sales')).toBe(true)
    expect(hasExactTag(tags, 'nghề sales')).toBe(false)
  })
})
