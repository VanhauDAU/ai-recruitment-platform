import { describe, expect, it } from 'vitest'
import {
  buildJobPreferenceTaxonomy,
  limitDesiredSpecializationIds,
  MAX_DESIRED_SPECIALIZATIONS,
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
})
