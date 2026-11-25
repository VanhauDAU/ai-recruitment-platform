import { getIntlLocale, m } from '@/shared/config/i18n'

export const PAGE_SIZE = 50

export const EMPTY_FILTERS = {
  search: '',
  group: undefined,
  source: undefined,
  status: 'active',
  ordering: 'name',
  cleanup: undefined,
}

// Chip của dải "Cần dọn": khóa → (tham số API, nhãn, số đếm trong summary).
export const CLEANUP_FILTERS = {
  ungrouped: { params: { ungrouped: true }, label: (count) => m.admin_catalog_cleanup_ungrouped({ count }) },
  duplicates: { params: { duplicates: true }, label: (count) => m.admin_catalog_cleanup_duplicates({ count }) },
}

export const SOURCE_LABELS = {
  seed: () => m.admin_catalog_source_seed(),
  import: () => m.admin_catalog_source_import(),
  employer: () => m.admin_catalog_source_employer(),
  admin: () => m.admin_catalog_source_admin(),
}

export const ORDERING_LABELS = {
  name: () => m.admin_catalog_order_name(),
  recent: () => m.admin_catalog_order_recent(),
  usage: () => m.admin_catalog_order_usage(),
}

export function skillListParams(filters, page) {
  const params = { page, page_size: PAGE_SIZE, ordering: filters.ordering }
  if (filters.search.trim()) params.search = filters.search.trim()
  if (filters.group) params.group = filters.group
  if (filters.source) params.source = filters.source
  if (filters.status !== 'all') params.is_active = filters.status === 'active'
  return { ...params, ...CLEANUP_FILTERS[filters.cleanup]?.params }
}

export function formatCount(value) {
  return new Intl.NumberFormat(getIntlLocale()).format(value)
}

export function usageText(usage) {
  return m.admin_catalog_usage_detail({
    jobs: formatCount(usage.jobs),
    cvs: formatCount(usage.cvs),
    candidates: formatCount(usage.candidates),
  })
}

export function emptyText(filters) {
  if (filters.cleanup === 'ungrouped') return m.admin_catalog_empty_ungrouped()
  if (filters.cleanup === 'duplicates') return m.admin_catalog_empty_duplicates()
  if (filters.search.trim()) return m.admin_catalog_empty_search({ query: filters.search.trim() })
  return m.admin_catalog_empty()
}

/** Lỗi theo trường của DRF → `form.setFields`. */
export function apiFieldErrors(error, fields) {
  const data = error?.response?.data
  if (!data || typeof data !== 'object') return []
  return Object.entries(data)
    .filter(([name, messages]) => fields.includes(name) && Array.isArray(messages))
    .map(([name, messages]) => ({ name, errors: messages.map(String) }))
}

export function groupOptions(groups) {
  return groups
    .filter((group) => group.is_active)
    .map((group) => ({ value: group.id, label: group.name }))
}
