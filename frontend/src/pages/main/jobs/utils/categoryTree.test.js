import { describe, expect, it } from 'vitest'
import {
  buildCategoryTree,
  nodeCheckState,
  reduceToCategoryIds,
  selectedLeafSet,
  toggleCategoryIds,
} from './categoryTree'

// Taxonomy 3 cấp: nhóm 1 -> nghề 10/11 -> vị trí 100/101/110.
const categories = [
  { id: 1, name: 'Nhóm A', parent: null },
  { id: 2, name: 'Nhóm B', parent: null },
  { id: 10, name: 'Nghề A1', parent: 1 },
  { id: 11, name: 'Nghề A2', parent: 1 },
  { id: 100, name: 'Vị trí A1a', parent: 10 },
  { id: 101, name: 'Vị trí A1b', parent: 10 },
  { id: 110, name: 'Vị trí A2a', parent: 11 },
  { id: 20, name: 'Nghề B1', parent: 2 },
]

const tree = buildCategoryTree(categories)

describe('buildCategoryTree', () => {
  it('phân loại nhóm gốc và tính lá đệ quy', () => {
    expect(tree.groups.map((g) => g.id)).toEqual([1, 2])
    expect(tree.leavesUnder(1).sort()).toEqual([100, 101, 110])
    expect(tree.leavesUnder(10).sort()).toEqual([100, 101])
    expect(tree.leavesUnder(20)).toEqual([20]) // nghề không có vị trí con -> chính nó là lá
  })
})

describe('nodeCheckState', () => {
  it('cha checked khi chọn cả nhóm', () => {
    const leaves = selectedLeafSet([1], tree.leavesUnder)
    expect(nodeCheckState(1, leaves, tree.leavesUnder)).toEqual({ checked: true, indeterminate: false })
    expect(nodeCheckState(10, leaves, tree.leavesUnder)).toEqual({ checked: true, indeterminate: false })
    expect(nodeCheckState(11, leaves, tree.leavesUnder)).toEqual({ checked: true, indeterminate: false })
  })

  it('cha indeterminate khi chỉ chọn một nghề con', () => {
    const leaves = selectedLeafSet([10], tree.leavesUnder)
    expect(nodeCheckState(1, leaves, tree.leavesUnder)).toEqual({ checked: false, indeterminate: true })
    expect(nodeCheckState(10, leaves, tree.leavesUnder)).toEqual({ checked: true, indeterminate: false })
    expect(nodeCheckState(11, leaves, tree.leavesUnder)).toEqual({ checked: false, indeterminate: false })
  })
})

describe('toggleCategoryIds', () => {
  it('bật nhóm -> lưu id nhóm rút gọn', () => {
    expect(toggleCategoryIds(1, [], tree)).toEqual([1])
  })

  it('tắt nhóm đang chọn -> rỗng', () => {
    expect(toggleCategoryIds(1, [1], tree)).toEqual([])
  })

  it('chọn đủ các nghề con -> tự gộp lên id nhóm', () => {
    const afterFirst = toggleCategoryIds(10, [], tree) // [10]
    expect(afterFirst).toEqual([10])
    const afterSecond = toggleCategoryIds(11, afterFirst, tree) // [10,11] -> gộp thành [1]
    expect(afterSecond).toEqual([1])
  })

  it('bỏ một nghề khi đang chọn cả nhóm -> khai triển phần còn lại', () => {
    expect(toggleCategoryIds(11, [1], tree).sort()).toEqual([10])
  })
})

describe('reduceToCategoryIds', () => {
  it('giữ từng lá khi nghề chỉ được chọn một phần', () => {
    const leaves = selectedLeafSet([100], tree.leavesUnder)
    expect(reduceToCategoryIds(leaves, tree.groups, tree.childrenOf, tree.leavesUnder)).toEqual([100])
  })
})
