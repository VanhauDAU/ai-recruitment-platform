import { describe, expect, it } from 'vitest'
import {
  buildJobPreferenceTaxonomy,
  desiredPositionValidationError,
  limitDesiredSpecializationIds,
  MAX_DESIRED_SPECIALIZATIONS,
  normalizeDesiredPositionOthers,
  selectionState,
} from './specialization-limit'

describe('desired specialization limit', () => {
  it('keeps only the first five selected specializations', () => {
    expect(limitDesiredSpecializationIds([1, 2, 3, 4, 5, 6])).toEqual([1, 2, 3, 4, 5])
    expect(MAX_DESIRED_SPECIALIZATIONS).toBe(5)
  })

  it('builds the three-level job taxonomy and resolves specialization leaves', () => {
    const taxonomy = buildJobPreferenceTaxonomy([
      { id: 1, name: 'Công nghệ thông tin', parent: null, category_type: 'occupation_group' },
      { id: 2, name: 'Phát triển phần mềm', parent: 1, category_type: 'domain' },
      { id: 3, name: 'Lập trình viên Frontend', parent: 2, category_type: 'specialization' },
    ])

    expect(taxonomy.groups.map((group) => group.id)).toEqual([1])
    expect(taxonomy.specializationsUnder(1)).toEqual([3])
    expect(selectionState([3], new Set([3]))).toEqual({ checked: true, indeterminate: false })
  })

  it('normalizes pasted custom positions and removes case-insensitive duplicates', () => {
    expect(normalizeDesiredPositionOthers([
      '  Kỹ sư dữ liệu  ; Product Owner',
      'kỹ SƯ dữ liệu',
      'Business Analyst\nScrum Master',
    ])).toEqual(['Kỹ sư dữ liệu', 'Product Owner', 'Business Analyst', 'Scrum Master'])
  })

  it('allows custom-only preferences and enforces the two five-item limits independently', () => {
    expect(desiredPositionValidationError([], ['Kỹ sư cầu nối'])).toBe('')
    expect(desiredPositionValidationError([], [])).toContain('ít nhất một')
    expect(desiredPositionValidationError([1, 2, 3, 4, 5], ['A', 'B', 'C', 'D', 'E'])).toBe('')
    expect(desiredPositionValidationError([1, 2, 3, 4, 5, 6], [])).toContain('trong danh mục')
    expect(desiredPositionValidationError([], ['A', 'B', 'C', 'D', 'E', 'F'])).toContain('chuyên môn khác')
  })
})
