import { formatRelativeDay, localDayKey } from '@/shared/lib/date-time'
import { m } from '@/shared/config/i18n'

/** Activity categories in display order (keys match the backend `category`). */
export const ACTIVITY_CATEGORIES = [
  { key: 'security', label: m.admin_activity_category_security() },
  { key: 'account', label: m.admin_activity_category_account() },
  { key: 'verification', label: m.admin_activity_category_verification() },
  { key: 'company', label: m.admin_activity_category_company() },
  { key: 'recruitment', label: m.admin_activity_category_recruitment() },
]

export const ACTIVITY_CATEGORY_LABELS = Object.fromEntries(
  ACTIVITY_CATEGORIES.map((item) => [item.key, item.label]),
)

export const ACTIVITY_ACTOR_LABELS = {
  admin: m.admin_activity_actor_admin(),
  self: m.admin_activity_actor_self(),
  member: m.admin_activity_actor_member(),
  system: m.admin_activity_actor_system(),
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
