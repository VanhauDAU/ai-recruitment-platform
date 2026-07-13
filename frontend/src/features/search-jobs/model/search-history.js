import { getJobs } from '@/entities/job'
import { hasPreferenceConsent } from '@/entities/consent'

const HISTORY_KEY = 'search_history'
const MAX_HISTORY = 8

export const SEARCH_BY_TABS = [
  { key: 'title', label: 'Tên việc làm' },
  { key: 'company', label: 'Tên công ty' },
  { key: 'both', label: 'Cả hai' },
]

// History entries: { q: string, by: 'title'|'company'|'both', count: number|null }.
// Tolerate the legacy plain-string format by normalising on read.
export function getHistory() {
  if (!hasPreferenceConsent()) {
    localStorage.removeItem(HISTORY_KEY)
    return []
  }
  try {
    const raw = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]')
    return raw.map((entry) => (typeof entry === 'string' ? { q: entry, by: 'title', count: null } : entry)).filter((entry) => entry?.q)
  } catch {
    return []
  }
}

// Persist a search immediately, then backfill its result count ("N việc làm").
// Writing first makes it survive an immediate navigation; the count updates async.
export function saveHistory(keyword, by = 'title') {
  if (!hasPreferenceConsent()) {
    localStorage.removeItem(HISTORY_KEY)
    return
  }
  const q = (keyword || '').trim()
  if (!q) return
  const rest = getHistory().filter((entry) => !(entry.q === q && entry.by === by))
  localStorage.setItem(HISTORY_KEY, JSON.stringify([{ q, by, count: null }, ...rest].slice(0, MAX_HISTORY)))

  const params = { search: q, page_size: 1 }
  if (by !== 'title') params.search_by = by
  getJobs(params)
    .then((data) => {
      const list = getHistory()
      const index = list.findIndex((entry) => entry.q === q && entry.by === by)
      if (index === -1) return
      list[index] = { ...list[index], count: data.count ?? null }
      localStorage.setItem(HISTORY_KEY, JSON.stringify(list))
    })
    .catch(() => {})
}

export function removeHistoryEntry(entry) {
  if (!hasPreferenceConsent()) return
  const updated = getHistory().filter((item) => !(item.q === entry.q && item.by === entry.by))
  localStorage.setItem(HISTORY_KEY, JSON.stringify(updated))
}

export function clearHistory() {
  localStorage.removeItem(HISTORY_KEY)
}
