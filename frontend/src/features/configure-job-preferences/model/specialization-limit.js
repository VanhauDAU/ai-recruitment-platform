export const MAX_DESIRED_SPECIALIZATIONS = 5
export const MAX_CUSTOM_DESIRED_POSITIONS = 5
export const MAX_PREFERRED_SKILLS = 20

const POSITION_DELIMITER = /[,;\n]+/

export function normalizePositionLabel(value) {
  return String(value || '').trim().replace(/\s+/g, ' ')
}

export function positionLabelKey(value) {
  return normalizePositionLabel(value).toLocaleLowerCase('vi-VN')
}

/**
 * Canonicalize both the new array contract and the legacy scalar contract.
 * Delimiters are accepted because the UI lets candidates paste several titles
 * at once; preserving the first spelling keeps the chips familiar to them.
 */
export function normalizeDesiredPositionOthers(value = []) {
  const entries = (Array.isArray(value) ? value : [value])
    .flatMap((item) => String(item || '').split(POSITION_DELIMITER))
    .map(normalizePositionLabel)
    .filter(Boolean)
  const seen = new Set()
  return entries.filter((item) => {
    const key = positionLabelKey(item)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function desiredPositionValidationError(specializationIds = [], customPositions = []) {
  const specializationCount = new Set(specializationIds || []).size
  const customPositionCount = normalizeDesiredPositionOthers(customPositions).length
  if (specializationCount < 1 && customPositionCount < 1) return 'Vui lòng chọn hoặc nhập ít nhất một vị trí chuyên môn.'
  if (specializationCount > MAX_DESIRED_SPECIALIZATIONS) return `Chỉ được chọn tối đa ${MAX_DESIRED_SPECIALIZATIONS} vị trí trong danh mục.`
  if (customPositionCount > MAX_CUSTOM_DESIRED_POSITIONS) return `Chỉ được nhập tối đa ${MAX_CUSTOM_DESIRED_POSITIONS} vị trí chuyên môn khác.`
  return ''
}

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
