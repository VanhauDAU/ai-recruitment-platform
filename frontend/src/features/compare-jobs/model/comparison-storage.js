import { sanitizeComparisonItems } from './comparison-state'

export const COMPARISON_STORAGE_KEY = 'procv_job_comparison_v1'
const STORAGE_VERSION = 1

function browserStorage() {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function readComparisonStorage(storage = browserStorage()) {
  if (!storage) return []
  try {
    const payload = JSON.parse(storage.getItem(COMPARISON_STORAGE_KEY) || 'null')
    if (!payload || payload.version !== STORAGE_VERSION) return []
    return sanitizeComparisonItems(payload.items)
  } catch {
    return []
  }
}

export function writeComparisonStorage(items, storage = browserStorage()) {
  if (!storage) return false
  try {
    storage.setItem(COMPARISON_STORAGE_KEY, JSON.stringify({
      version: STORAGE_VERSION,
      items: sanitizeComparisonItems(items),
    }))
    return true
  } catch {
    return false
  }
}

export function clearComparisonStorage(storage = browserStorage()) {
  if (!storage) return
  try {
    storage.removeItem(COMPARISON_STORAGE_KEY)
  } catch {
    // Storage có thể bị chặn; state trong memory vẫn hoạt động.
  }
}
