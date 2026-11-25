import { m } from '@/shared/config/i18n'

export const CATEGORY_TYPES = {
  occupation_group: { label: () => m.admin_catalog_type_group(), color: 'green', child: 'domain' },
  domain: { label: () => m.admin_catalog_type_domain(), color: 'blue', child: 'specialization' },
  specialization: { label: () => m.admin_catalog_type_specialization(), color: 'purple', child: null },
}

// Bỏ dấu từng ký tự để vị trí khớp trong chuỗi đã bỏ dấu trùng với chuỗi gốc (tô sáng được).
export function foldText(value) {
  return [...String(value)]
    .map((char) => char.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\u0111/gi, 'd').toLowerCase().charAt(0) || char)
    .join('')
}

/** Danh sách phẳng → cây theo `parent`; nút lá không có `children` để bảng không vẽ nút mở. */
export function buildCategoryTree(categories) {
  const nodes = new Map(categories.map((category) => [category.id, { ...category, key: category.id }]))
  const roots = []
  nodes.forEach((node) => {
    const parent = node.parent && nodes.get(node.parent)
    if (!parent) roots.push(node)
    else (parent.children ??= []).push(node)
  })
  return roots
}

/** Giữ nút khớp điều kiện và mọi nút tổ tiên của chúng. */
export function filterCategoryTree(nodes, matches) {
  return nodes.flatMap((node) => {
    const children = node.children ? filterCategoryTree(node.children, matches) : []
    if (!matches(node) && !children.length) return []
    return [{ ...node, children: children.length ? children : undefined }]
  })
}

export function branchKeys(nodes) {
  return nodes.flatMap((node) => (node.children ? [node.key, ...branchKeys(node.children)] : []))
}

export function categoryMatcher({ search, type, status }) {
  const term = foldText(search.trim())
  return (category) => (!term || foldText(category.name).includes(term) || foldText(category.name_en).includes(term))
    && (!type || category.category_type === type)
    && (status === 'all' || (status === 'active') === (category.status === 'active'))
}

/** Mục có thể làm cha khi chuyển `category` sang nhánh khác: cùng cấp với cha hiện tại. */
export function parentOptions(categories, category) {
  const parent = categories.find((item) => item.id === category.parent)
  if (!parent) return []
  const names = new Map(categories.map((item) => [item.id, item.name]))
  return categories
    .filter((item) => item.category_type === parent.category_type)
    .map((item) => ({
      value: item.id,
      label: item.parent ? `${item.name} · ${names.get(item.parent)}` : item.name,
    }))
}
