import { describe, expect, it } from 'vitest'
import { SUGGESTION_LIMIT, buildInterestedJobTiers } from './interested-jobs-tiers'

describe('buildInterestedJobTiers', () => {
  it('ưu tiên nhu cầu đã lưu: chuyên môn + tỉnh/thành -> chỉ chuyên môn -> mới nhất', () => {
    const tiers = buildInterestedJobTiers({
      preference: {
        desired_specializations: [{ id: 75 }, { id: 76 }],
        preferred_provinces: [{ id: 48 }, { id: 1 }],
      },
      selectedCategories: ['999'],
      selectedLocations: ['888'],
    })

    expect(tiers).toHaveLength(3)
    expect(tiers[0].getAll('category')).toEqual(['75', '76'])
    expect(tiers[0].getAll('location')).toEqual(['48', '1'])
    expect(tiers[1].getAll('category')).toEqual(['75', '76'])
    expect(tiers[1].getAll('location')).toEqual([])
    expect(tiers[2].getAll('category')).toEqual([])
    expect(tiers[2].get('page_size')).toBe(String(SUGGESTION_LIMIT))
  })

  it('khách chưa có nhu cầu dùng bộ lọc trên URL', () => {
    const tiers = buildInterestedJobTiers({
      preference: null,
      selectedCategories: [11],
      selectedLocations: [22],
    })
    expect(tiers[0].getAll('category')).toEqual(['11'])
    expect(tiers[0].getAll('location')).toEqual(['22'])
  })

  it('gộp tầng trùng nhau khi thiếu tiêu chí', () => {
    const tiers = buildInterestedJobTiers({ preference: null })
    // Không chuyên môn, không địa điểm -> cả 3 tầng như nhau, chỉ còn 1.
    expect(tiers).toHaveLength(1)
    expect(tiers[0].toString()).toBe(`page_size=${SUGGESTION_LIMIT}`)
  })
})
