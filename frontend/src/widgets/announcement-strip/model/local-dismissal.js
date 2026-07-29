function storageKey(item) {
  return `announcement-strip:${item.id}:v${item.dismiss?.version || 1}`
}

export function readLocalDismissal(item) {
  try {
    const value = window.sessionStorage.getItem(storageKey(item))
    if (value === 'closed') return Number.POSITIVE_INFINITY
    const timestamp = Number(value)
    return Number.isFinite(timestamp) && timestamp > Date.now() ? timestamp : 0
  } catch {
    return 0
  }
}

export function storeLocalDismissal(item, hiddenUntil) {
  try {
    window.sessionStorage.setItem(
      storageKey(item),
      hiddenUntil === Number.POSITIVE_INFINITY ? 'closed' : String(hiddenUntil),
    )
  } catch {
    // Storage can be unavailable in private mode; in-memory state still works.
  }
}
