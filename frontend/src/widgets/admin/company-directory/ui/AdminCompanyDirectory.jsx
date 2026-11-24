import { keepPreviousData, useQuery } from '@tanstack/react-query'
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  BankOutlined,
  EditOutlined,
  FileSyncOutlined,
  SearchOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import { Alert, Button, Empty, Input, Select, Skeleton } from 'antd'
import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router'
import {
  adminCompanyKeys,
  getAdminCompanies,
  getAdminCompanySummary,
  RECRUITER_VERIFICATION,
} from '@/entities/company/admin-company'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { getIntlLocale, m } from '@/shared/config/i18n'
import { adminPath } from '@/shared/config/portals'
import { AdminDataActions } from '@/shared/ui/admin'
import WorkspaceListFooter from '@/shared/ui/workspace-list/WorkspaceListFooter'
import WorkspaceQuickFilters from '@/shared/ui/workspace-list/WorkspaceQuickFilters'
import WorkspaceStatusTiles from '@/shared/ui/workspace-list/WorkspaceStatusTiles'
import AdminCompanyListRow from './AdminCompanyListRow'
import '@/shared/ui/workspace-list/workspace-list.css'
import '@/shared/ui/workspace-list/workspace-table.css'
import '../admin-company-directory.css'

const PAGE_SIZE = 20
const EMPTY_PAGE = { count: 0, results: [] }
const DEFAULT_ORDERING = '-updated_at'
const FILTER_KEYS = ['q', 'has_owner', 'recruiter_verification_status']
const formatCount = (value) => (value ?? 0).toLocaleString(getIntlLocale())

const VERIFICATION_OPTIONS = [
  { value: '', label: m.admin_company_list_verification_all() },
  ...Object.entries(RECRUITER_VERIFICATION).map(([value, { label }]) => ({ value, label })),
]

const ORDERING_OPTIONS = [
  { value: '-updated_at', label: m.admin_company_list_order_updated() },
  { value: 'company_name', label: m.admin_company_list_order_name() },
  { value: '-company_name', label: m.admin_company_list_order_name_desc() },
  { value: '-recruiter_count', label: m.admin_company_list_order_recruiters() },
  { value: '-pending_update_count', label: m.admin_company_list_order_updates() },
]

// Management checks on `has_owner`; the first tile and chips share the filter.
const OWNER_CHIPS = [
  { value: 'false', label: m.admin_company_list_chip_no_owner(), tone: 'amber' },
  { value: 'ineligible', label: m.admin_company_list_chip_ineligible(), tone: 'slate' },
]

// A header click sorts descending, a second ascending, a third resets.
function SortHeader({ field, ordering, onSort, children }) {
  const active = ordering === field || ordering === `-${field}`
  const Arrow = ordering === field ? ArrowUpOutlined : ArrowDownOutlined
  const next = ordering === `-${field}` ? field : ordering === field ? DEFAULT_ORDERING : `-${field}`
  return (
    <button type="button" className="ws-sort" aria-pressed={active} onClick={() => onSort(next)}>
      {children}
      <Arrow aria-hidden className="ws-sort__icon" />
    </button>
  )
}

export default function AdminCompanyDirectory({ onOpenTab }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const filters = Object.fromEntries(FILTER_KEYS.map((key) => [key, searchParams.get(key) || '']))
  const ordering = searchParams.get('ordering') || DEFAULT_ORDERING
  const page = Number(searchParams.get('page') || 1) || 1
  const [searchInput, setSearchInput] = useState(filters.q)
  const params = Object.fromEntries(
    Object.entries({ ...filters, ordering, page }).filter(([, value]) => value !== ''),
  )
  const companiesQuery = useQuery({
    queryKey: adminCompanyKeys.list(params),
    queryFn: ({ signal }) => getAdminCompanies(params, { signal }),
    // Keep the rows on screen while the next page, filter or order loads.
    placeholderData: keepPreviousData,
  })
  const summaryQuery = useQuery({
    queryKey: adminCompanyKeys.summary,
    queryFn: ({ signal }) => getAdminCompanySummary({ signal }),
  })
  const companies = companiesQuery.data || EMPTY_PAGE
  const summary = summaryQuery.data
  const summaryCount = (key) => (summary ? formatCount(summary[key]) : undefined)

  useEffect(() => setSearchInput(filters.q), [filters.q])

  useEffect(() => {
    const normalized = searchInput.trim()
    if (normalized === filters.q) return undefined
    const timeoutId = window.setTimeout(() => {
      const next = new URLSearchParams(searchParams)
      if (normalized) next.set('q', normalized)
      else next.delete('q')
      next.delete('page')
      setSearchParams(next, { replace: true })
    }, 400)
    return () => window.clearTimeout(timeoutId)
  }, [filters.q, searchInput, searchParams, setSearchParams])

  function patchParams(changes, { resetPage = true } = {}) {
    const next = new URLSearchParams(searchParams)
    Object.entries(changes).forEach(([key, value]) => {
      if (value == null || value === '') next.delete(key)
      else next.set(key, String(value))
    })
    if (resetPage) next.delete('page')
    setSearchParams(next)
  }

  function chooseTile(value) {
    if (value === 'updates' || value === 'content-changes') onOpenTab?.(value)
    else patchParams({ has_owner: value })
  }

  function clearFilters() {
    setSearchInput('')
    patchParams(Object.fromEntries(FILTER_KEYS.map((key) => [key, null])))
  }

  function openCompany(company) {
    navigate(adminPath(`/companies/${company.public_id}`), {
      state: {
        origin: {
          pathname: location.pathname,
          search: location.search,
          label: m.admin_company_list_origin_label(),
        },
      },
    })
  }

  function openUpdates(company) {
    navigate(adminPath(`/companies?tab=updates&company=${encodeURIComponent(company.public_id)}`))
  }

  const sortBy = (value) => patchParams({ ordering: value === DEFAULT_ORDERING ? null : value })
  const results = companies.results || []
  const hasFilters = FILTER_KEYS.some((key) => filters[key])
  const firstRow = (page - 1) * PAGE_SIZE + 1
  const lastRow = Math.min(page * PAGE_SIZE, companies.count || 0)

  return (
    <div className="wt-page">
      <div className="acl-tiles">
        <WorkspaceStatusTiles
          ariaLabel={m.admin_company_list_tiles_aria()}
          value={filters.has_owner}
          onChange={chooseTile}
          items={[
            { key: 'all', value: '', label: m.admin_company_list_tile_all(), icon: <BankOutlined />, count: summaryCount('total') },
            { key: 'owner', value: 'not_single', label: m.admin_company_list_tile_owner_review(), icon: <TeamOutlined />, count: summaryCount('companies_without_single_owner') },
            { key: 'updates', value: 'updates', label: m.admin_company_list_tile_updates(), icon: <FileSyncOutlined />, count: summaryCount('pending_update_requests') },
            { key: 'content', value: 'content-changes', label: m.admin_company_list_tile_content(), icon: <EditOutlined />, count: summaryCount('unreviewed_content_changes') },
          ]}
        />
      </div>

      <div className="wt-table acl-table">
        <div className="wt-toolbar">
          <WorkspaceQuickFilters
            label={m.admin_company_list_quick_label()}
            ariaLabel={m.admin_company_list_quick_aria()}
            items={OWNER_CHIPS}
            value={filters.has_owner}
            onChange={(value) => patchParams({ has_owner: value })}
            clearLabel={m.admin_company_list_clear_filters()}
            onClear={hasFilters ? clearFilters : undefined}
          />
          <div className="wt-filters">
            <Select
              size="large"
              aria-label={m.admin_company_list_verification_aria()}
              onChange={(value) => patchParams({ recruiter_verification_status: value })}
              options={VERIFICATION_OPTIONS}
              value={filters.recruiter_verification_status}
            />
            <Select
              size="large"
              aria-label={m.admin_company_list_sort_aria()}
              onChange={sortBy}
              options={ORDERING_OPTIONS}
              value={ORDERING_OPTIONS.some((option) => option.value === ordering) ? ordering : undefined}
              placeholder={m.admin_company_list_sort_by_column()}
            />
            <Input
              allowClear
              size="large"
              type="search"
              className="wt-filters__search"
              aria-label={m.admin_company_list_search_aria()}
              prefix={<SearchOutlined className="text-slate-400" aria-hidden />}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder={m.admin_company_list_search_placeholder()}
              value={searchInput}
            />
            <div className="wt-filters__extra">
              <AdminDataActions
                columns={[
                  { key: 'public_id', label: m.admin_company_list_csv_code() },
                  { key: 'company_name', label: m.admin_company_list_col_company() },
                  { key: 'tax_code', label: m.admin_company_list_csv_tax_code() },
                  { label: m.admin_company_list_csv_owner(), value: (row) => row.owners?.[0]?.full_name || row.owners?.[0]?.email || '' },
                  { key: 'recruiter_count', label: m.admin_company_list_col_recruiters() },
                  { key: 'pending_update_count', label: m.admin_company_list_col_updates() },
                  { key: 'updated_at', label: m.admin_company_list_col_updated() },
                ]}
                exportLabel={m.admin_company_list_export_label()}
                exportScopeLabel={m.admin_company_list_export_scope({ count: results.length, page })}
                filename={`cong-ty-trang-${page}`}
                onRefresh={() => Promise.all([companiesQuery.refetch(), summaryQuery.refetch()])}
                refreshing={companiesQuery.isFetching || summaryQuery.isFetching}
                rows={results}
              />
            </div>
          </div>
        </div>

        <div className="wt-head">
          <span><SortHeader field="company_name" ordering={ordering} onSort={sortBy}>{m.admin_company_list_col_company()}</SortHeader></span>
          <span><SortHeader field="owner_count" ordering={ordering} onSort={sortBy}>{m.admin_company_list_col_owner()}</SortHeader></span>
          <span><SortHeader field="recruiter_count" ordering={ordering} onSort={sortBy}>{m.admin_company_list_col_recruiters()}</SortHeader></span>
          <span><SortHeader field="pending_update_count" ordering={ordering} onSort={sortBy}>{m.admin_company_list_col_updates()}</SortHeader></span>
          <span><SortHeader field="updated_at" ordering={ordering} onSort={sortBy}>{m.admin_company_list_col_updated()}</SortHeader></span>
          <span>{m.admin_company_list_col_actions()}</span>
        </div>

        {companiesQuery.isError && (
          <div className="p-3">
            <Alert
              action={<Button onClick={() => companiesQuery.refetch()}>{m.admin_company_list_retry()}</Button>}
              description={getApiErrorMessage(companiesQuery.error)}
              showIcon
              title={m.admin_company_list_load_error()}
              type="error"
            />
          </div>
        )}

        {companiesQuery.isLoading ? (
          <div aria-label={m.admin_company_list_loading_aria()}>
            {[1, 2, 3, 4].map((item) => (
              <div key={item} className="wt-row">
                <Skeleton active avatar title={{ width: '40%' }} paragraph={{ rows: 1 }} className="acl-skeleton" />
              </div>
            ))}
          </div>
        ) : results.length === 0 && !companiesQuery.isError ? (
          <div className="wt-empty">
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={m.admin_company_list_empty()} />
          </div>
        ) : (
          <div
            aria-busy={companiesQuery.isFetching}
            className={`transition-opacity ${companiesQuery.isPlaceholderData ? 'opacity-60' : ''}`}
          >
            {results.map((company) => (
              <AdminCompanyListRow
                key={company.public_id}
                company={company}
                onOpen={openCompany}
                onOpenUpdates={openUpdates}
              />
            ))}
          </div>
        )}
      </div>

      {summaryQuery.isError && (
        <span className="text-xs text-amber-700">{m.admin_company_list_summary_error()}</span>
      )}

      {companies.count > 0 && (
        <WorkspaceListFooter
          summary={m.admin_company_list_range({ first: firstRow, last: lastRow, total: formatCount(companies.count) })}
          page={page}
          pageSize={PAGE_SIZE}
          total={companies.count}
          onChange={(nextPage) => patchParams({ page: nextPage }, { resetPage: false })}
        />
      )}
    </div>
  )
}
