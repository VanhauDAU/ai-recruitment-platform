const SOURCE_ORDER = {
  system: 0,
  remote: 1,
}

function isRenderable(item) {
  return item
    && typeof item.id === 'string'
    && item.id
    && typeof item.message === 'string'
    && item.message
    && Number.isInteger(item.priorityTier)
    && item.priorityTier >= 1
    && item.priorityTier <= 6
}

export function resolveAnnouncementQueue(items) {
  const unique = new Map()
  for (const item of items || []) {
    if (!isRenderable(item) || unique.has(item.id)) continue
    unique.set(item.id, item)
  }
  const candidates = [...unique.values()]
  if (!candidates.length) return []

  const winningTier = Math.min(...candidates.map((item) => item.priorityTier))
  return candidates
    .filter((item) => item.priorityTier === winningTier)
    .sort((left, right) => (
      (right.priority || 0) - (left.priority || 0)
      || (SOURCE_ORDER[left.source] ?? 9) - (SOURCE_ORDER[right.source] ?? 9)
      || left.id.localeCompare(right.id)
    ))
}
