export const MAX_DESIRED_SPECIALIZATIONS = 5

export function limitDesiredSpecializationIds(ids = []) {
  return ids.slice(0, MAX_DESIRED_SPECIALIZATIONS)
}

export function buildJobPreferenceTaxonomy(categories = []) {
  const childrenByParent = new Map()
  for (const category of categories) {
    const parentId = category.parent ?? null
    const children = childrenByParent.get(parentId) || []
    children.push(category)
    childrenByParent.set(parentId, children)
  }

  const specializationsUnder = (categoryId) => (childrenByParent.get(categoryId) || []).flatMap((child) => {
    if (child.category_type === 'specialization') return [child.id]
    return specializationsUnder(child.id)
  })

  return {
    groups: childrenByParent.get(null) || [],
    childrenByParent,
    specializationsUnder,
  }
}

export function selectionState(ids, selectedIds) {
  const selectedCount = ids.filter((id) => selectedIds.has(id)).length
  return {
    checked: ids.length > 0 && selectedCount === ids.length,
    indeterminate: selectedCount > 0 && selectedCount < ids.length,
  }
}
