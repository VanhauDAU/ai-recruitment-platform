const ALLOWED_FILTERS = new Set([
  'q', 'category', 'type', 'lifecycle', 'revision_status', 'review_due', 'ordering', 'page', 'page_size',
])

export function knowledgeListParams(searchParams) {
  return Object.fromEntries(
    [...searchParams.entries()].filter(([key, value]) => ALLOWED_FILTERS.has(key) && value),
  )
}

export function updateKnowledgeListParams(searchParams, patch) {
  const next = new URLSearchParams(searchParams)
  Object.entries(patch).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') next.delete(key)
    else next.set(key, String(value))
  })
  if (!Object.hasOwn(patch, 'page')) next.delete('page')
  return next
}
