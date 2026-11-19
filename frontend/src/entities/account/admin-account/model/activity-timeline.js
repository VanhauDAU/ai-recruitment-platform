import { formatRelativeDay, localDayKey } from '@/shared/lib/date-time'

/** Activity categories in display order (keys match the backend `category`). */
export const ACTIVITY_CATEGORIES = [
  { key: 'security', label: 'Bảo mật' },
  { key: 'account', label: 'Tài khoản' },
  { key: 'verification', label: 'Xác thực' },
  { key: 'company', label: 'Công ty' },
  { key: 'recruitment', label: 'Tuyển dụng' },
]

export const ACTIVITY_CATEGORY_LABELS = Object.fromEntries(
  ACTIVITY_CATEGORIES.map((item) => [item.key, item.label]),
)

export const ACTIVITY_ACTOR_LABELS = {
  admin: 'Quản trị viên',
  self: 'Chính tài khoản',
  member: 'Thành viên công ty',
  system: 'Hệ thống',
}

export function parseActivityCategory(value) {
  return ACTIVITY_CATEGORY_LABELS[value] ? value : ''
}

/**
 * Newest-first entries → `[{ key, label, entries }]`, one group per local
 * calendar day, keeping the server order inside each day.
 */
export function groupActivityByDay(entries = [], now = new Date()) {
  const groups = []
  for (const entry of entries) {
    const key = localDayKey(entry.occurred_at)
    const last = groups[groups.length - 1]
    if (last?.key === key) last.entries.push(entry)
    else groups.push({ key, label: formatRelativeDay(entry.occurred_at, now), entries: [entry] })
  }
  return groups
}
