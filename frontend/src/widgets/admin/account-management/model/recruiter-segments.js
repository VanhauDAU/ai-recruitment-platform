import { m } from '@/shared/config/i18n'

/**
 * Saved views on top of the recruiter list. Each tile is a filter and its
 * count comes from the same server rule as the filtered list, so the number
 * on the tile always equals the rows shown after clicking it.
 */
export const SEGMENT_FILTER_KEYS = ['next_action', 'company_state', 'status']

export const RECRUITER_SEGMENTS = [
  {
    key: 'all',
    label: m.admin_segment_all(),
    hint: m.admin_segment_all_hint(),
    filters: {},
    count: (summary) => summary.totals?.total,
  },
  {
    key: 'admin_queue',
    label: m.admin_segment_queue(),
    hint: m.admin_segment_queue_hint(),
    tone: 'warning',
    filters: { next_action: 'admin_queue', ordering: 'next_action' },
    count: (summary) => summary.next_actions?.admin_queue,
  },
  {
    key: 'overdue',
    label: m.admin_segment_overdue(),
    hint: m.admin_segment_overdue_hint(),
    tone: 'critical',
    filters: { next_action: 'verification_overdue', ordering: 'next_action' },
    count: (summary) => summary.next_actions?.verification_overdue,
  },
  {
    key: 'resubmission',
    label: m.admin_segment_resubmission(),
    hint: m.admin_segment_resubmission_hint(),
    filters: { next_action: 'awaiting_resubmission' },
    count: (summary) => summary.next_actions?.awaiting_resubmission,
  },
  {
    key: 'companyless',
    label: m.admin_segment_companyless(),
    hint: m.admin_segment_companyless_hint(),
    filters: { company_state: 'missing' },
    count: (summary) => summary.companyless,
  },
  {
    key: 'restricted',
    label: m.admin_segment_restricted(),
    hint: m.admin_segment_restricted_hint(),
    filters: { status: 'inactive,banned' },
    count: (summary) => summary.totals?.restricted,
  },
]

const DEFAULT_ORDERING = '-date_joined'

/** The tile whose filters exactly match the current ones (or none). */
export function activeRecruiterSegment(filters) {
  return RECRUITER_SEGMENTS.find((segment) => SEGMENT_FILTER_KEYS.every(
    (key) => (filters[key] || '') === (segment.filters[key] || ''),
  ))?.key || ''
}

/** Filters after clicking a tile: segment keys replaced, the rest kept. */
export function applyRecruiterSegment(filters, segmentKey) {
  const segment = RECRUITER_SEGMENTS.find((item) => item.key === segmentKey)
  if (!segment) return filters
  const cleared = Object.fromEntries(SEGMENT_FILTER_KEYS.map((key) => [key, '']))
  const leavingQueueOrder = filters.ordering === 'next_action' && !segment.filters.ordering
  return {
    ...filters,
    ...cleared,
    ...(leavingQueueOrder ? { ordering: DEFAULT_ORDERING } : {}),
    ...segment.filters,
  }
}
