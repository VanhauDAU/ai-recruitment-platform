import { keepPreviousData, useQuery } from '@tanstack/react-query'
import {
  AlertOutlined,
  ArrowDownOutlined,
  ArrowUpOutlined,
  CheckCircleOutlined,
  EditOutlined,
  FileTextOutlined,
  PauseCircleOutlined,
  SearchOutlined,
  SyncOutlined,
} from '@ant-design/icons'
import { Alert, Button, Empty, Input, Select, Skeleton } from 'antd'
import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router'
import {
  adminJobKeys,
  getAdminJobs,
  getAdminJobSummary,
  JOB_SCOPE_OPTIONS,
} from '@/entities/job/admin-job'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { getIntlLocale, m } from '@/shared/config/i18n'
import { adminPath } from '@/shared/config/portals'
import { AdminDataActions } from '@/shared/ui/admin'
import WorkspaceListFooter from '@/shared/ui/workspace-list/WorkspaceListFooter'
import WorkspaceQuickFilters from '@/shared/ui/workspace-list/WorkspaceQuickFilters'
import WorkspaceStatusTiles from '@/shared/ui/workspace-list/WorkspaceStatusTiles'
import AdminJobListRow from './AdminJobListRow'
import '@/shared/ui/workspace-list/workspace-list.css'
import '@/shared/ui/workspace-list/workspace-table.css'
import '../admin-job-list.css'

const PAGE_SIZE = 20
const EMPTY_PAGE = { count: 0, results: [] }
const DEFAULT_SCOPE = 'all'
const DEFAULT_ORDERING = '-created_at'
const formatCount = (value) => (value ?? 0).toLocaleString(getIntlLocale())

// Tiles: the scopes an admin checks first; `summaryKey` reads GET .../summary.
const SCOPE_TILES = [
  { value: 'all', label: m.admin_job_list_tile_all(), summaryKey: 'total', icon: <FileTextOutlined /> },
  { value: 'active', label: m.admin_job_list_tile_active(), summaryKey: 'active', icon: <CheckCircleOutlined /> },
  { value: 'reported', label: m.admin_job_list_tile_reported(), summaryKey: 'pending_reports', icon: <AlertOutlined /> },
  { value: 'held', label: m.admin_job_list_tile_held(), summaryKey: 'held', icon: <PauseCircleOutlined /> },
  { value: 'resubmitted', label: m.admin_job_list_tile_resubmitted(), summaryKey: 'resubmitted', icon: <SyncOutlined /> },
  { value: 'draft', label: m.admin_job_list_tile_draft(), summaryKey: 'draft', icon: <EditOutlined /> },
]

// Chips: the remaining scopes that need a look, toggled on and off.
const SCOPE_CHIPS = [
  { value: 'expired', label: m.admin_job_list_chip_expired(), tone: 'orange' },
  { value: 'hidden', label: m.admin_job_list_chip_hidden(), tone: 'red' },
  { value: 'closed', label: m.admin_job_list_chip_closed(), tone: 'slate' },
]

const ORDERING_OPTIONS = [
  { value: '-created_at', label: m.admin_job_list_order_newest() },
  { value: 'created_at', label: m.admin_job_list_order_oldest() },
  { value: '-submitted_at', label: m.admin_job_list_order_submitted() },
  { value: 'company', label: m.admin_job_list_order_company() },
  { value: 'employer', label: m.admin_job_list_order_employer() },
]

function scopeToParams(scope) {
  if (scope === 'all') return {}
  if (scope === 'reported') return { has_reports: 'true' }
  // Candidate-facing states are computed server-side; `held` is an admin hold.
  if (['active', 'expired', 'hidden', 'held', 'resubmitted'].includes(scope)) return { scope }
  return { status: scope }
}

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

export default function AdminJobList() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const scope = searchParams.get('job_scope') || DEFAULT_SCOPE
  const query = searchParams.get('job_q') || ''
  const ordering = searchParams.get('job_ordering') || DEFAULT_ORDERING
  const page = Number(searchParams.get('job_page') || 1) || 1
  const [searchInput, setSearchInput] = useState(query)
  const params = {
    ...scopeToParams(scope),
    ...(query && { q: query }),
    ordering,
    page,
  }
  const jobsQuery = useQuery({
    queryKey: adminJobKeys.list(params),
    queryFn: ({ signal }) => getAdminJobs(params, { signal }),
    // Keep the rows on screen while the next page, scope or order loads.
    placeholderData: keepPreviousData,
  })
  const summaryQuery = useQuery({
    queryKey: adminJobKeys.summary,
    queryFn: ({ signal }) => getAdminJobSummary({ signal }),
  })
  const jobs = jobsQuery.data || EMPTY_PAGE
  const summary = summaryQuery.data || {}

  useEffect(() => setSearchInput(query), [query])

  useEffect(() => {
    const normalized = searchInput.trim()
    if (normalized === query) return undefined
    const timeoutId = window.setTimeout(() => {
      const next = new URLSearchParams(searchParams)
      if (normalized) next.set('job_q', normalized)
      else next.delete('job_q')
      next.delete('job_page')
      setSearchParams(next, { replace: true })
    }, 400)
    return () => window.clearTimeout(timeoutId)
  }, [query, searchInput, searchParams, setSearchParams])

  function patchParams(changes, { resetPage = true, replace = false } = {}) {
    const next = new URLSearchParams(searchParams)
    Object.entries(changes).forEach(([key, value]) => {
      if (value == null || value === '') next.delete(key)
      else next.set(key, String(value))
    })
    if (resetPage) next.delete('job_page')
    setSearchParams(next, { replace })
  }

  function chooseScope(value) {
    patchParams({ job_scope: value === DEFAULT_SCOPE ? null : value })
  }

  function openJob(job) {
    navigate(adminPath(`/job-moderation/${job.public_id}`), {
      state: {
        origin: {
          pathname: location.pathname,
          search: location.search,
          label: m.admin_job_list_origin_label(),
        },
      },
    })
  }

  const sortBy = (value) => patchParams({ job_ordering: value === DEFAULT_ORDERING ? null : value })
  const results = jobs.results || []
  const firstRow = (page - 1) * PAGE_SIZE + 1
  const lastRow = Math.min(page * PAGE_SIZE, jobs.count || 0)
  const summaryCount = (key) => (summaryQuery.data ? summary[key] ?? 0 : undefined)

  return (
    <div className="wt-page">
      <WorkspaceStatusTiles
        ariaLabel={m.admin_job_list_tiles_aria()}
        value={scope}
        onChange={chooseScope}
        items={SCOPE_TILES.map((tile) => ({
          key: tile.value,
          value: tile.value,
          label: tile.label,
          icon: tile.icon,
          count: summaryCount(tile.summaryKey) === undefined ? undefined : formatCount(summaryCount(tile.summaryKey)),
        }))}
      />

      <div className="wt-table ajl-table">
        <div className="wt-toolbar">
          <WorkspaceQuickFilters
            label={m.admin_job_list_quick_label()}
            ariaLabel={m.admin_job_list_quick_aria()}
            items={SCOPE_CHIPS.map((chip) => ({ ...chip, count: summaryCount(chip.value) }))}
            value={scope}
            onChange={(value) => chooseScope(value || DEFAULT_SCOPE)}
            clearLabel={m.admin_job_list_clear_filters()}
            onClear={scope !== DEFAULT_SCOPE || query ? () => {
              setSearchInput('')
              patchParams({ job_scope: null, job_q: null })
            } : undefined}
          />
          <div className="wt-filters">
            <Select
              size="large"
              aria-label={m.admin_job_list_scope_aria()}
              onChange={chooseScope}
              options={JOB_SCOPE_OPTIONS}
              value={scope}
            />
            <Select
              size="large"
              aria-label={m.admin_job_list_sort_aria()}
              onChange={sortBy}
              options={ORDERING_OPTIONS}
              value={ORDERING_OPTIONS.some((option) => option.value === ordering) ? ordering : undefined}
              placeholder={m.admin_job_list_sort_by_column()}
            />
            <Input
              allowClear
              size="large"
              type="search"
              className="wt-filters__search"
              aria-label={m.admin_job_list_search_aria()}
              prefix={<SearchOutlined className="text-slate-400" aria-hidden />}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder={m.admin_job_list_search_placeholder()}
              value={searchInput}
            />
            <div className="wt-filters__extra">
              <AdminDataActions
                columns={[
                  { key: 'public_id', label: m.admin_job_list_csv_code() },
                  { key: 'title', label: m.admin_job_list_col_job() },
                  { key: 'company_name', label: m.admin_job_list_csv_company() },
                  { label: m.admin_job_list_col_status(), value: (row) => row.status_label || row.status },
                  { key: 'deadline', label: m.admin_job_list_csv_deadline() },
                  { key: 'created_at', label: m.admin_job_list_csv_created() },
                  { key: 'submitted_at', label: m.admin_job_list_csv_submitted() },
                  { key: 'application_count', label: m.admin_job_list_csv_applications() },
                  { key: 'pending_report_count', label: m.admin_job_list_csv_reports() },
                ]}
                exportLabel={m.admin_job_list_export_label()}
                exportScopeLabel={m.admin_job_list_export_scope({ count: results.length, page })}
                filename={`tin-tuyen-dung-trang-${page}`}
                onRefresh={() => Promise.all([jobsQuery.refetch(), summaryQuery.refetch()])}
                refreshing={jobsQuery.isFetching || summaryQuery.isFetching}
                rows={results}
              />
            </div>
          </div>
        </div>

        <div className="wt-head">
          <span><SortHeader field="title" ordering={ordering} onSort={sortBy}>{m.admin_job_list_col_job()}</SortHeader></span>
          <span><SortHeader field="status" ordering={ordering} onSort={sortBy}>{m.admin_job_list_col_status()}</SortHeader></span>
          <span><SortHeader field="pending_reports" ordering={ordering} onSort={sortBy}>{m.admin_job_list_col_signals()}</SortHeader></span>
          <span><SortHeader field="application_count" ordering={ordering} onSort={sortBy}>{m.admin_job_list_col_applications()}</SortHeader></span>
          <span><SortHeader field="deadline" ordering={ordering} onSort={sortBy}>{m.admin_job_list_col_deadline()}</SortHeader></span>
          <span>{m.admin_job_list_col_actions()}</span>
        </div>

        {jobsQuery.isError && (
          <div className="p-3">
            <Alert
              action={<Button onClick={() => jobsQuery.refetch()}>{m.admin_job_list_retry()}</Button>}
              description={getApiErrorMessage(jobsQuery.error)}
              showIcon
              title={m.admin_job_list_load_error()}
              type="error"
            />
          </div>
        )}

        {jobsQuery.isLoading ? (
          <div aria-label={m.admin_job_list_loading_aria()}>
            {[1, 2, 3, 4].map((item) => (
              <div key={item} className="wt-row">
                <Skeleton active title={{ width: '50%' }} paragraph={{ rows: 2 }} className="ajl-skeleton" />
              </div>
            ))}
          </div>
        ) : results.length === 0 && !jobsQuery.isError ? (
          <div className="wt-empty">
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={m.admin_job_list_empty()} />
          </div>
        ) : (
          <div
            aria-busy={jobsQuery.isFetching}
            className={`transition-opacity ${jobsQuery.isPlaceholderData ? 'opacity-60' : ''}`}
          >
            {results.map((job) => <AdminJobListRow key={job.public_id} job={job} onOpen={openJob} />)}
          </div>
        )}
      </div>

      {summaryQuery.isError && (
        <span className="text-xs text-amber-700">{m.admin_job_list_summary_error()}</span>
      )}

      {jobs.count > 0 && (
        <WorkspaceListFooter
          summary={m.admin_job_list_range({ first: firstRow, last: lastRow, total: formatCount(jobs.count) })}
          page={page}
          pageSize={PAGE_SIZE}
          total={jobs.count}
          onChange={(nextPage) => patchParams({ job_page: nextPage }, { resetPage: false })}
        />
      )}
    </div>
  )
}
