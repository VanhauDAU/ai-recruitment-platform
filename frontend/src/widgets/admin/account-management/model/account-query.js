import dayjs from '@/shared/lib/dayjs'

/** URL ⇄ filter state for the account and recruiter lists. */
export const DEFAULT_FILTERS = {
  q: '',
  status: '',
  email_verified: '',
  has_active_session: '',
  company: '',
  company_state: '',
  verification_status: '',
  next_action: '',
  ordering: '-date_joined',
  created_range: [],
  last_login_range: [],
}
export const SIMPLE_FILTER_KEYS = [
  'q',
  'status',
  'email_verified',
  'has_active_session',
  'company',
  'company_state',
  'verification_status',
  'next_action',
  'ordering',
]
export const ACCOUNT_QUERY_KEYS = [
  ...SIMPLE_FILTER_KEYS,
  'created_from',
  'created_to',
  'last_login_from',
  'last_login_to',
  'page',
  'page_size',
]
export const INVITATION_QUERY_KEYS = [
  'invite_q',
  'invite_status',
  'invite_by',
  'invite_page',
  'invite_ordering',
]
export const VERIFICATION_QUERY_KEYS = [
  'verify_q',
  'verify_status',
  'verify_document',
  'verify_phone',
  'verify_age',
  'verify_from',
  'verify_to',
  'verify_page',
  'verify_ordering',
]

function rangeFromQuery(searchParams, fromKey, toKey) {
  const from = searchParams.get(fromKey)
  const to = searchParams.get(toKey)
  return from && to ? [dayjs(from), dayjs(to)] : []
}

export function filtersFromQuery(searchParams) {
  return {
    ...DEFAULT_FILTERS,
    ...Object.fromEntries(
      SIMPLE_FILTER_KEYS.map((key) => [
        key,
        searchParams.get(key) || DEFAULT_FILTERS[key],
      ]),
    ),
    created_range: rangeFromQuery(searchParams, 'created_from', 'created_to'),
    last_login_range: rangeFromQuery(searchParams, 'last_login_from', 'last_login_to'),
  }
}

export const PAGE_SIZES = [20, 40, 60]

export function pageSizeFromQuery(searchParams) {
  const size = Number(searchParams.get('page_size'))
  return PAGE_SIZES.includes(size) ? size : PAGE_SIZES[0]
}

export function queryParams(scope, tab, filters, search, page, pageSize) {
  const params = {
    scope,
    page,
    page_size: pageSize === PAGE_SIZES[0] ? '' : pageSize,
    q: search,
    status: filters.status,
    email_verified: filters.email_verified,
    has_active_session: filters.has_active_session,
    company: filters.company.trim(),
    company_state: filters.company_state,
    verification_status: filters.verification_status,
    next_action: scope === 'recruiters' ? filters.next_action : '',
    ordering: filters.ordering,
  }
  if (scope === 'users' && ['candidate', 'admin'].includes(tab)) params.role = tab
  if (filters.created_range?.length === 2) {
    params.created_from = filters.created_range[0].format('YYYY-MM-DD')
    params.created_to = filters.created_range[1].format('YYYY-MM-DD')
  }
  if (filters.last_login_range?.length === 2) {
    params.last_login_from = filters.last_login_range[0].format('YYYY-MM-DD')
    params.last_login_to = filters.last_login_range[1].format('YYYY-MM-DD')
  }
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== '' && value != null),
  )
}
