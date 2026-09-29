export const MAX_COMPARISON_JOBS = 3

const cleanText = (value) => String(value || '').trim()

export function comparisonItemFromJob(job) {
  if (!job) return null
  const publicId = cleanText(job.publicId || job.public_id)
  const slug = cleanText(job.slug)
  if (!publicId || !slug) return null
  return {
    publicId,
    slug,
    title: cleanText(job.title) || 'Việc làm chưa có tiêu đề',
    companyName: cleanText(job.companyName || job.company_name),
    companyLogoUrl: cleanText(job.companyLogoUrl || job.company_logo_url),
  }
}

export function sanitizeComparisonItems(value) {
  if (!Array.isArray(value)) return []
  const seen = new Set()
  const items = []
  for (const raw of value) {
    const item = comparisonItemFromJob(raw)
    if (!item) continue
    const key = item.publicId || item.slug
    if (seen.has(key)) continue
    seen.add(key)
    items.push(item)
    if (items.length === MAX_COMPARISON_JOBS) break
  }
  return items
}

function matchesItem(item, identifier) {
  const value = typeof identifier === 'object'
    ? identifier?.publicId || identifier?.public_id || identifier?.slug
    : identifier
  return Boolean(value) && (item.publicId === value || item.slug === value)
}

export function comparisonReducer(items, action) {
  switch (action.type) {
    case 'add': {
      const item = comparisonItemFromJob(action.job)
      if (!item || items.some((current) => matchesItem(current, item))) return items
      if (items.length >= MAX_COMPARISON_JOBS) return items
      return [...items, item]
    }
    case 'remove':
      return items.filter((item) => !matchesItem(item, action.identifier))
    case 'replace':
      return sanitizeComparisonItems(action.items)
    case 'hydrate-if-empty':
      return items.length ? items : sanitizeComparisonItems(action.items)
    case 'clear':
      return []
    default:
      return items
  }
}

export function comparisonHasItem(items, identifier) {
  return items.some((item) => matchesItem(item, identifier))
}
