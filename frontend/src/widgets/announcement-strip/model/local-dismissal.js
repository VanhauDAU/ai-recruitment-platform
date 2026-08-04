import { ANNOUNCEMENT_DISMISS_MODES } from '@/entities/announcement'

function storageKey(item) {
  return `announcement-strip:${item.id}:v${item.dismiss?.version || 1}`
}

export function readLocalDismissal(item) {
  if (item.dismiss?.mode === ANNOUNCEMENT_DISMISS_MODES.LOCKED) return 0
  try {
    const key = storageKey(item)
    const value = window.localStorage.getItem(key)
      ?? window.sessionStorage.getItem(key)
    if (value === 'closed') return Number.POSITIVE_INFINITY
    const timestamp = Number(value)
    return Number.isFinite(timestamp) && timestamp > Date.now() ? timestamp : 0
  } catch {
    return 0
  }
}

export function storeLocalDismissal(item, hiddenUntil) {
  if (item.dismiss?.mode === ANNOUNCEMENT_DISMISS_MODES.LOCKED) return
  try {
    window.localStorage.setItem(
      storageKey(item),
      hiddenUntil === Number.POSITIVE_INFINITY ? 'closed' : String(hiddenUntil),
    )
  } catch {
    // Storage can be unavailable in private mode; in-memory state still works.
  }
}
