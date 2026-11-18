function categoryParentId(category) {
  return category?.parent?.id ?? category?.parent ?? null
}

function validCategoryIds(values = []) {
  return [...new Set(values.map(Number).filter((value) => Number.isInteger(value) && value > 0))]
}

// Cây taxonomy nghề là dữ liệu domain dùng bởi cả trang tìm việc lẫn các
// workflow lưu tiêu chí. Mỗi node ở bất kỳ cấp nào đều có thể đại diện cho
// toàn bộ lá bên dưới nó.
export function buildCategoryTree(categories = []) {
  const childrenOf = {}
  const byId = new Map()

  categories.forEach((category) => {
    byId.set(category.id, category)
    const parentId = categoryParentId(category) ?? 'root'
    ;(childrenOf[parentId] ||= []).push(category)
  })

  function leavesUnder(id, visited = new Set()) {
    if (visited.has(id)) return []
    const nextVisited = new Set(visited).add(id)
    const children = childrenOf[id] || []
    return children.length
      ? children.flatMap((child) => leavesUnder(child.id, nextVisited))
      : [id]
  }

  return { byId, childrenOf, groups: childrenOf.root || [], leavesUnder }
}

export function selectedLeafSet(appliedIds, leavesUnder) {
  return new Set(validCategoryIds(appliedIds).flatMap((id) => leavesUnder(id)))
}

export function nodeCheckState(id, selectedLeaves, leavesUnder) {
  const leaves = leavesUnder(id)
  const selected = leaves.reduce(
    (count, leaf) => count + (selectedLeaves.has(leaf) ? 1 : 0),
    0,
  )
  return {
    checked: selected > 0 && selected === leaves.length,
    indeterminate: selected > 0 && selected < leaves.length,
  }
}

export function toggleNodeLeaves(id, selectedLeaves, leavesUnder) {
  const leaves = leavesUnder(id)
  const allSelected = leaves.every((leaf) => selectedLeaves.has(leaf))
  const next = new Set(selectedLeaves)
  leaves.forEach((leaf) => (allSelected ? next.delete(leaf) : next.add(leaf)))
  return next
}

// Rút tập lá thành danh sách node ngắn nhất. Nếu cả một nhánh đã chọn thì chỉ
// gửi ID của node cha; backend sẽ OR các nhánh và mở rộng xuống cấp con.
export function reduceToCategoryIds(selectedLeaves, groups, childrenOf, leavesUnder) {
  function reduceNode(node) {
    const leaves = leavesUnder(node.id)
    if (leaves.length && leaves.every((leaf) => selectedLeaves.has(leaf))) return [node.id]
    return (childrenOf[node.id] || []).flatMap(reduceNode)
  }

  return groups.flatMap(reduceNode)
}

export function toggleCategoryIds(id, appliedIds, tree) {
  const { groups, childrenOf, leavesUnder } = tree
  const next = toggleNodeLeaves(id, selectedLeafSet(appliedIds, leavesUnder), leavesUnder)
  return reduceToCategoryIds(next, groups, childrenOf, leavesUnder)
}

