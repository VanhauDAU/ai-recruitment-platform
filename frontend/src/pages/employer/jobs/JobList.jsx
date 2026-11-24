import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  EditOutlined,
  EyeInvisibleOutlined,
  PlusOutlined,
  ProfileOutlined,
  SearchOutlined,
  StopOutlined,
} from '@ant-design/icons'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Empty, Input, Select, Skeleton } from 'antd'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import {
  closeEmployerJob,
  deleteEmployerJob,
  duplicateEmployerJob,
  getEmployerJobPage,
  jobKeys,
} from '@/entities/job/job'
import { campaignKeys, getCampaignOptions } from '@/entities/campaign/campaign'
import { useEmployerReadiness } from '@/entities/account/employer-profile'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { employerAppPath } from '@/shared/config/portals'
import { message } from '@/shared/lib/toast'
import { MascotEmpty } from '@/shared/ui/mascot'
import useConfirmAction from '@/shared/ui/confirm-action/use-confirm-action'
import WorkspaceQuickFilters from '@/shared/ui/workspace-list/WorkspaceQuickFilters'
import WorkspaceListFooter from '@/shared/ui/workspace-list/WorkspaceListFooter'
import WorkspaceStatusTiles from '@/shared/ui/workspace-list/WorkspaceStatusTiles'
import JobListCard from './JobListCard'
import {
  JOB_ATTENTION_FILTERS,
  JOB_SORT_COLUMNS,
  JOB_SORT_OPTIONS,
  JOB_STATUS_TABS,
  formatCount,
} from './job-list-presentation'
import '@/shared/ui/workspace-list/workspace-list.css'
import '@/shared/ui/workspace-list/workspace-table.css'
import './employer-jobs.css'
import { m } from '@/shared/config/i18n'

const PAGE_SIZE = 20
const SEARCH_DELAY_MS = 400
const EMPTY_PAGE = { count: 0, next: null, previous: null, results: [] }
// URL search params the list reads; `page` is handled on its own.
const FILTER_KEYS = ['status', 'q', 'campaign', 'attention', 'ordering']
const STATUS_ICONS = {
  all: <ProfileOutlined />,
  active: <CheckCircleOutlined />,
  hidden: <EyeInvisibleOutlined />,
  draft: <EditOutlined />,
  expired: <ClockCircleOutlined />,
  closed: <StopOutlined />,
}
const primaryLinkClass = 'inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg !bg-emerald-600 px-3.5 text-sm font-semibold !text-white shadow-sm transition hover:!bg-emerald-500'

function JobListSkeleton() {
  return (
    <div aria-label={m.employer_job_list_loading_aria()}>
      {[1, 2, 3, 4].map((item) => (
        <div key={item} className="wt-row">
          <Skeleton active title={{ width: '55%' }} paragraph={{ rows: 1, width: '80%' }} className="ejl-row__skeleton" />
        </div>
      ))}
    </div>
  )
}

function SortHeader({ column, ordering, onSort, children }) {
  const value = JOB_SORT_COLUMNS[column]
  const active = ordering === value
  const Arrow = value.startsWith('-') ? ArrowDownOutlined : ArrowUpOutlined
  return (
    <button type="button" className="ws-sort" aria-pressed={active} onClick={() => onSort(active ? '' : value)}>
      {children}
      <Arrow aria-hidden className="ws-sort__icon" />
    </button>
  )
}

function useJobMutation(mutationFn, success, failure) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs', 'employer-list'] })
      message.success(success)
    },
    onError: (error) => message.error(getApiErrorMessage(error, failure)),
  })
}

export default function JobList() {
  const [searchParams, setSearchParams] = useSearchParams()
  const filters = Object.fromEntries(FILTER_KEYS.map((key) => [key, searchParams.get(key) || '']))
  const { status, q: query, campaign, attention, ordering } = filters
  const page = Math.max(Number(searchParams.get('page')) || 1, 1)
  const [searchValue, setSearchValue] = useState(query)
  const [campaignMenuOpened, setCampaignMenuOpened] = useState(false)
  const searchTimer = useRef(null)
  const { confirmationModal, requestConfirmation } = useConfirmAction()
  const { canAccessCandidateData } = useEmployerReadiness()
  const queryParams = useMemo(() => {
    const params = { page }
    Object.entries({ status, q: query, campaign, attention, ordering }).forEach(([key, value]) => {
      if (value) params[key] = value
    })
    return params
  }, [attention, campaign, ordering, page, query, status])
  const jobsQuery = useQuery({
    queryKey: jobKeys.employerList(queryParams),
    queryFn: () => getEmployerJobPage(queryParams),
    // Keep the rows and tab counts on screen while the next tab/page loads.
    placeholderData: keepPreviousData,
  })
  // Campaign names load once the filter is opened or the URL already sets one.
  const campaignsQuery = useQuery({
    queryKey: campaignKeys.options,
    queryFn: getCampaignOptions,
    enabled: campaignMenuOpened || Boolean(campaign),
    staleTime: 60_000,
  })
  const closeMutation = useJobMutation(closeEmployerJob, m.employer_job_detail_closed(), m.employer_job_detail_close_failed())
  const duplicateMutation = useJobMutation(duplicateEmployerJob, m.employer_job_list_duplicated(), m.employer_job_list_duplicate_failed())
  const deleteMutation = useJobMutation(deleteEmployerJob, m.employer_job_list_deleted(), m.employer_job_list_delete_failed())
  const pageData = jobsQuery.data || EMPTY_PAGE
  const jobs = pageData.results || []
  const counts = pageData.status_counts
  const attentionCounts = pageData.attention_counts
  const hasFilters = Boolean(status || query || campaign || attention)
  const campaignOptions = useMemo(() => [
    { value: '', label: m.employer_job_list_campaign_all() },
    ...(campaignsQuery.data || []).map((item) => ({ value: item.public_id, label: item.name })),
  ], [campaignsQuery.data])

  // Follow back/forward navigation without trimming what the user is typing.
  useEffect(() => {
    setSearchValue((current) => (current.trim() === query ? current : query))
  }, [query])
  useEffect(() => () => window.clearTimeout(searchTimer.current), [])

  // Functional update so a debounced search never overwrites a newer tab/page.
  const replaceFilters = useCallback((next, options) => {
    setSearchParams((current) => {
      const params = new URLSearchParams(current)
      Object.entries(next).forEach(([key, value]) => {
        if (value) params.set(key, String(value))
        else params.delete(key)
      })
      if (!Object.hasOwn(next, 'page')) params.delete('page')
      return params
    }, options)
  }, [setSearchParams])

  function search(value, delay = SEARCH_DELAY_MS) {
    setSearchValue(value)
    window.clearTimeout(searchTimer.current)
    searchTimer.current = window.setTimeout(() => replaceFilters({ q: value.trim() }, { replace: true }), delay)
  }

  // Filters narrow the list; the chosen order stays.
  function clearFilters() {
    window.clearTimeout(searchTimer.current)
    setSearchValue('')
    setSearchParams(ordering ? { ordering } : {})
  }

  const sortBy = (value) => replaceFilters({ ordering: value })
  const isBusy = (mutation, publicId) => mutation.isPending && mutation.variables === publicId
  const firstRow = (page - 1) * PAGE_SIZE + 1
  const lastRow = Math.min(page * PAGE_SIZE, pageData.count || 0)

  return (
    <section className="wt-page">
      <WorkspaceStatusTiles
        ariaLabel={m.employer_job_list_status_filter_aria()}
        value={status}
        onChange={(value) => replaceFilters({ status: value })}
        items={JOB_STATUS_TABS.map((tab) => ({
          key: tab.countKey,
          value: tab.value,
          label: tab.label,
          icon: STATUS_ICONS[tab.countKey],
          count: counts?.[tab.countKey] === undefined ? undefined : formatCount(counts[tab.countKey]),
        }))}
      />

      <div className="wt-table ejl-table">
        <div className="wt-toolbar">
          <WorkspaceQuickFilters
            label={m.employer_job_list_attention_label()}
            ariaLabel={m.employer_job_list_attention_aria()}
            items={JOB_ATTENTION_FILTERS.map((item) => ({ ...item, count: attentionCounts?.[item.value] }))}
            value={attention}
            onChange={(value) => replaceFilters({ attention: value })}
            clearLabel={m.employer_job_list_clear_filters()}
            onClear={hasFilters ? clearFilters : undefined}
          />
          <div className="wt-filters">
            <Select
              size="large"
              aria-label={m.employer_job_list_campaign_aria()}
              showSearch={{ optionFilterProp: 'label' }}
              loading={campaignsQuery.isFetching}
              // Hold the raw id back until its name has loaded.
              value={campaign && !campaignsQuery.data ? undefined : campaign}
              placeholder={m.employer_job_list_campaign_all()}
              options={campaignOptions}
              onOpenChange={(open) => open && setCampaignMenuOpened(true)}
              onChange={(value) => replaceFilters({ campaign: value })}
            />
            <Select
              size="large"
              aria-label={m.employer_job_list_sort_aria()}
              value={ordering}
              options={JOB_SORT_OPTIONS}
              onChange={sortBy}
            />
            <Input
              size="large"
              allowClear
              className="wt-filters__search"
              aria-label={m.employer_job_list_search_aria()}
              prefix={<SearchOutlined className="text-slate-400" aria-hidden />}
              placeholder={m.employer_job_list_search_placeholder()}
              type="search"
              value={searchValue}
              onChange={(event) => search(event.target.value)}
              onClear={() => search('', 0)}
              onPressEnter={() => search(searchValue, 0)}
            />
          </div>
        </div>

        <div className="wt-head">
          <span>{m.employer_job_list_col_job()}</span>
          <span>{m.employer_job_list_col_status()}</span>
          <span><SortHeader column="candidates" ordering={ordering} onSort={sortBy}>{m.employer_job_list_col_candidates()}</SortHeader></span>
          <span><SortHeader column="views" ordering={ordering} onSort={sortBy}>{m.employer_job_list_col_views()}</SortHeader></span>
          <span><SortHeader column="deadline" ordering={ordering} onSort={sortBy}>{m.employer_job_list_col_deadline()}</SortHeader></span>
          <span>{m.employer_job_list_col_actions()}</span>
        </div>

        {jobsQuery.isError && (
          <div className="p-3">
            <Alert
              type="error"
              showIcon
              title={m.employer_job_list_load_failed({ reason: getApiErrorMessage(jobsQuery.error, m.employer_job_detail_try_later()) })}
              action={<Button size="small" danger onClick={() => jobsQuery.refetch()}>{m.employer_job_detail_retry()}</Button>}
            />
          </div>
        )}

        {jobsQuery.isLoading ? (
          <JobListSkeleton />
        ) : jobs.length === 0 && !jobsQuery.isError ? (
          hasFilters ? (
            <div className="wt-empty">
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={m.employer_job_list_no_match()}>
                <Button onClick={clearFilters}>{m.employer_job_list_clear_filters()}</Button>
              </Empty>
            </div>
          ) : (
            <MascotEmpty className="py-12" description={m.employer_job_list_empty()}>
              <Link className={primaryLinkClass} to={employerAppPath('/jobs/new')}>
                <PlusOutlined /> {m.employer_job_list_post_first()}
              </Link>
            </MascotEmpty>
          )
        ) : (
          <div
            aria-busy={jobsQuery.isFetching}
            aria-live="polite"
            className={`transition-opacity ${jobsQuery.isPlaceholderData ? 'opacity-60' : ''}`}
          >
            {jobs.map((job) => (
              <JobListCard
                key={job.public_id}
                job={job}
                candidateDataAccess={canAccessCandidateData}
                busy={[closeMutation, deleteMutation, duplicateMutation].some((item) => isBusy(item, job.public_id))}
                onClose={(publicId) => closeMutation.mutateAsync(publicId)}
                onDelete={(publicId) => deleteMutation.mutateAsync(publicId)}
                onDuplicate={(publicId) => duplicateMutation.mutate(publicId)}
                requestConfirmation={requestConfirmation}
              />
            ))}
          </div>
        )}
      </div>

      {pageData.count > 0 && (
        <WorkspaceListFooter
          summary={m.employer_job_list_range({ first: firstRow, last: lastRow, total: formatCount(pageData.count) })}
          page={page}
          pageSize={PAGE_SIZE}
          total={pageData.count}
          onChange={(nextPage) => replaceFilters({ page: nextPage })}
        />
      )}
      {confirmationModal}
    </section>
  )
}
