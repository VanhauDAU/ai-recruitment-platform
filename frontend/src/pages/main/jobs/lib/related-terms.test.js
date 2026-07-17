import { describe, expect, it } from 'vitest'
import { relatedCategoryChips, relatedSearchTerms } from './related-terms'

// Cây: 1 (nhóm) -> 2 (nghề) -> 3,4 (chuyên môn); 5 (nghề cùng nhóm); 9 (nhóm khác)
const CATEGORIES = [
  { id: 1, name: 'Công nghệ thông tin', parent: null },
  { id: 2, name: 'Lập trình Web', parent: 1 },
  { id: 3, name: 'Frontend Developer', parent: 2 },
  { id: 4, name: 'Backend Developer', parent: 2 },
  { id: 5, name: 'Data/AI', parent: 1 },
  { id: 9, name: 'Nhân sự', parent: null },
]

describe('relatedSearchTerms', () => {
  it('danh mục có con -> gợi ý tên các con', () => {
    expect(relatedSearchTerms(CATEGORIES, [2])).toEqual(['Frontend Developer', 'Backend Developer'])
  })

  it('danh mục lá -> gợi ý anh em cùng cha', () => {
    expect(relatedSearchTerms(CATEGORIES, [3])).toEqual(['Backend Developer'])
  })

  it('không có ngữ cảnh danh mục -> rỗng', () => {
    expect(relatedSearchTerms(CATEGORIES, [])).toEqual([])
    expect(relatedSearchTerms([], [3])).toEqual([])
  })
})

describe('relatedCategoryChips', () => {
  it('lá -> tổ tiên rồi anh em, không lặp, không chứa chính nó', () => {
    const ids = relatedCategoryChips(CATEGORIES, [3]).map((item) => item.id)
    expect(ids).toEqual([1, 2, 4])
  })

  it('nghề giữa cây -> tổ tiên + con + nghề cùng nhóm', () => {
    const ids = relatedCategoryChips(CATEGORIES, [2]).map((item) => item.id)
    expect(ids).toEqual([1, 3, 4, 5])
  })

  it('chưa chọn gì -> các nhóm nghề gốc', () => {
    const ids = relatedCategoryChips(CATEGORIES, []).map((item) => item.id)
    expect(ids).toEqual([1, 9])
  })
})
