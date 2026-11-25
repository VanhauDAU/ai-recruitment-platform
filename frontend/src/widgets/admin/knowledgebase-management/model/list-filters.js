const ALLOWED_FILTERS = new Set([
  'q', 'category', 'type', 'lifecycle', 'revision_status', 'review_due', 'published', 'ordering', 'page', 'page_size',
])

// Summary tiles: each one is a set of filters; they replace one another.
export const KNOWLEDGE_VIEWS = {
  all: {},
  published: { published: 'true' },
  drafts: { revision_status: 'DRAFT' },
  overdue: { review_due: 'overdue' },
}
const VIEW_KEYS = ['published', 'revision_status', 'review_due']

export function knowledgeListParams(searchParams) {
  return Object.fromEntries(
    [...searchParams.entries()].filter(([key, value]) => ALLOWED_FILTERS.has(key) && value),
  )
}

/** Summary counts follow the other filters but not the tile filters, so the
 * numbers on the tiles stay put while one of them is selected. */
export function knowledgeSummaryParams(params) {
  const { ordering: _ordering, page: _page, page_size: _pageSize, ...filters } = params
  return Object.fromEntries(Object.entries(filters).filter(([key]) => !VIEW_KEYS.includes(key)))
}

/** The tile whose filters match the current ones exactly, or ''. */
export function activeKnowledgeView(params) {
  return Object.entries(KNOWLEDGE_VIEWS).find(([, filters]) => VIEW_KEYS.every(
    (key) => (params[key] || '') === (filters[key] || ''),
  ))?.[0] || ''
}

/** Patch that switches to a tile: its filters set, the other tile filters cleared. */
export function knowledgeViewPatch(view) {
  return { ...Object.fromEntries(VIEW_KEYS.map((key) => [key, undefined])), ...KNOWLEDGE_VIEWS[view] }
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
