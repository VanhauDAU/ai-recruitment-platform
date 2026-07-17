// Gợi ý liên quan theo ngữ cảnh danh mục đang lọc (kiểu TopCV):
// - relatedSearchTerms: từ khóa "Ứng viên cũng tìm kiếm" = tên các vị trí chuyên
//   môn cùng nhánh với danh mục đang chọn (con của nó, hoặc anh em nếu là lá).
// - relatedCategoryChips: chip "Danh mục Nghề liên quan" = tổ tiên + con + anh
//   em của danh mục đang chọn; chưa chọn gì thì gợi ý các nhóm nghề gốc.

function buildIndex(categories) {
  const byId = new Map(categories.map((category) => [category.id, category]))
  const childrenOf = new Map()
  for (const category of categories) {
    const key = category.parent ?? 'root'
    if (!childrenOf.has(key)) childrenOf.set(key, [])
    childrenOf.get(key).push(category)
  }
  return { byId, childrenOf }
}

export function relatedSearchTerms(categories, selectedCategories, { limit = 5 } = {}) {
  if (!categories.length || !selectedCategories.length) return []
  const { byId, childrenOf } = buildIndex(categories)
  const current = byId.get(selectedCategories[0])
  if (!current) return []
  const pool = childrenOf.get(current.id)?.length
    ? childrenOf.get(current.id)
    : (childrenOf.get(current.parent ?? 'root') || []).filter((item) => item.id !== current.id)
  return pool.slice(0, limit).map((item) => item.name)
}

export function relatedCategoryChips(categories, selectedCategories, { limit = 8 } = {}) {
  if (!categories.length) return []
  const { byId, childrenOf } = buildIndex(categories)
  if (!selectedCategories.length) {
    return (childrenOf.get('root') || []).slice(0, limit)
  }
  const current = byId.get(selectedCategories[0])
  if (!current) return []

  const ancestors = []
  let cursor = byId.get(current.parent)
  while (cursor) {
    ancestors.unshift(cursor)
    cursor = byId.get(cursor.parent)
  }
  const children = childrenOf.get(current.id) || []
  const siblings = (childrenOf.get(current.parent ?? 'root') || []).filter((item) => item.id !== current.id)

  const seen = new Set([current.id])
  const chips = []
  for (const item of [...ancestors, ...children, ...siblings]) {
    if (seen.has(item.id)) continue
    seen.add(item.id)
    chips.push(item)
    if (chips.length >= limit) break
  }
  return chips
}
