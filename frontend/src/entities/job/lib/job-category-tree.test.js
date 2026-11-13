import { describe, expect, it } from 'vitest'
import {
  buildCategoryTree,
  nodeCheckState,
  reduceToCategoryIds,
  selectedLeafSet,
  toggleCategoryIds,
} from './job-category-tree'

const categories = [
  { id: 1, name: 'Công nghệ thông tin', parent: null },
  { id: 10, name: 'Phát triển phần mềm', parent: 1 },
  { id: 11, name: 'Dữ liệu', parent: 1 },
  { id: 100, name: 'Frontend Developer', parent: 10 },
  { id: 101, name: 'Backend Developer', parent: 10 },
  { id: 110, name: 'Data Engineer', parent: 11 },
]

const tree = buildCategoryTree(categories)

describe('job category tree selection', () => {
  it('builds the explicit group, profession and specialization hierarchy', () => {
    expect(tree.groups.map(({ id }) => id)).toEqual([1])
    expect(tree.childrenOf[1].map(({ id }) => id)).toEqual([10, 11])
    expect(tree.leavesUnder(10)).toEqual([100, 101])
  })

  it('derives checked and indeterminate state from selected leaves', () => {
    const selectedLeaves = selectedLeafSet([100], tree.leavesUnder)

    expect(nodeCheckState(1, selectedLeaves, tree.leavesUnder)).toEqual({
      checked: false,
      indeterminate: true,
    })
    expect(nodeCheckState(100, selectedLeaves, tree.leavesUnder)).toEqual({
      checked: true,
      indeterminate: false,
    })
  })

  it('reduces a fully selected branch to its shortest node ID', () => {
    const selectedLeaves = selectedLeafSet([100, 101], tree.leavesUnder)

    expect(reduceToCategoryIds(
      selectedLeaves,
      tree.groups,
      tree.childrenOf,
      tree.leavesUnder,
    )).toEqual([10])
  })

  it('keeps branches ORed when multiple nodes are selected', () => {
    const afterSoftware = toggleCategoryIds(10, [], tree)
    const afterData = toggleCategoryIds(11, afterSoftware, tree)

    expect(afterSoftware).toEqual([10])
    expect(afterData).toEqual([1])
  })

  it('expands the remaining branch when one profession is removed from a selected group', () => {
    expect(toggleCategoryIds(11, [1], tree)).toEqual([10])
  })
})
