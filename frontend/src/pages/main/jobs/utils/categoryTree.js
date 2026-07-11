// Cây danh mục nghề 3 cấp (nhóm nghề -> nghề -> vị trí chuyên môn) dùng chung cho
// CategoryPicker (modal) và bộ lọc sidebar. URL chỉ lưu id ở dạng rút gọn nhất
// (chọn cả nhóm -> lưu id nhóm; backend tự mở rộng xuống cấp con), còn checkbox
// suy trạng thái checked/indeterminate từ tập LÁ đang chọn để cha/con luôn khớp.

export function buildCategoryTree(categories) {
  const childrenOf = {}
  for (const category of categories) {
    ;(childrenOf[category.parent ?? 'root'] ||= []).push(category)
  }
  const leavesUnder = (id) =>
    childrenOf[id]?.length ? childrenOf[id].flatMap((child) => leavesUnder(child.id)) : [id]
  return { groups: childrenOf.root || [], childrenOf, leavesUnder }
}

// Tập lá được phủ bởi danh sách id đã áp dụng (id ở bất kỳ cấp nào).
export function selectedLeafSet(appliedIds, leavesUnder) {
  return new Set(appliedIds.flatMap((id) => leavesUnder(id)))
}

// Trạng thái checkbox của một node: checked khi mọi lá con đều được chọn,
// indeterminate khi chỉ một phần.
export function nodeCheckState(id, selectedLeaves, leavesUnder) {
  const leaves = leavesUnder(id)
  const selected = leaves.reduce((count, leaf) => count + (selectedLeaves.has(leaf) ? 1 : 0), 0)
  return { checked: selected > 0 && selected === leaves.length, indeterminate: selected > 0 && selected < leaves.length }
}

// Bật/tắt toàn bộ nhánh của một node trong tập lá (trả về Set mới).
export function toggleNodeLeaves(id, selectedLeaves, leavesUnder) {
  const leaves = leavesUnder(id)
  const allSelected = leaves.every((leaf) => selectedLeaves.has(leaf))
  const next = new Set(selectedLeaves)
  leaves.forEach((leaf) => (allSelected ? next.delete(leaf) : next.add(leaf)))
  return next
}

// Rút tập lá về danh sách id ngắn nhất: cả nhóm/nghề được chọn hết -> id của nó,
// còn lại -> từng lá.
export function reduceToCategoryIds(selectedLeaves, groups, childrenOf, leavesUnder) {
  const ids = []
  for (const group of groups) {
    const groupLeaves = leavesUnder(group.id)
    if (groupLeaves.every((leaf) => selectedLeaves.has(leaf))) {
      ids.push(group.id)
      continue
    }
    for (const child of childrenOf[group.id] || []) {
      const childLeaves = leavesUnder(child.id)
      if (childLeaves.every((leaf) => selectedLeaves.has(leaf))) ids.push(child.id)
      else childLeaves.forEach((leaf) => selectedLeaves.has(leaf) && ids.push(leaf))
    }
  }
  return ids
}

// Bật/tắt một node rồi rút về danh sách id rút gọn để ghi lên URL.
export function toggleCategoryIds(id, appliedIds, tree) {
  const { groups, childrenOf, leavesUnder } = tree
  const next = toggleNodeLeaves(id, selectedLeafSet(appliedIds, leavesUnder), leavesUnder)
  return reduceToCategoryIds(next, groups, childrenOf, leavesUnder)
}
