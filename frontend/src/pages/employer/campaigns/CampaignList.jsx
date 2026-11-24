import {
  CalendarOutlined,
  CheckCircleOutlined,
  EditOutlined,
  FlagOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Alert, Button, Empty, Input, Select, Skeleton } from 'antd'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import {
  CAMPAIGN_ATTENTION_SCOPES,
  CAMPAIGN_ORDERING_OPTIONS,
  CAMPAIGN_STATUS_TABS,
  campaignKeys,
  getCampaigns,
} from '@/entities/campaign/campaign'
import { useEmployerReadiness } from '@/entities/account/employer-profile'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { m, getIntlLocale } from '@/shared/config/i18n'
import { employerAppPath } from '@/shared/config/portals'
import { MascotEmpty } from '@/shared/ui/mascot'
import WorkspaceQuickFilters from '@/shared/ui/workspace-list/WorkspaceQuickFilters'
import WorkspaceListFooter from '@/shared/ui/workspace-list/WorkspaceListFooter'
import WorkspaceStatusTiles from '@/shared/ui/workspace-list/WorkspaceStatusTiles'
import CampaignListRow from './CampaignListRow'
import '@/shared/ui/workspace-list/workspace-list.css'
import '@/shared/ui/workspace-list/workspace-table.css'
import './campaign-list.css'

const PAGE_SIZE = 20
const SEARCH_DELAY_MS = 400
const DEFAULT_ORDERING = 'status'
const STATUS_ICONS = {
  all: <FlagOutlined />,
  active: <PlayCircleOutlined />,
  paused: <PauseCircleOutlined />,
  scheduled: <CalendarOutlined />,
  draft: <EditOutlined />,
  ended: <CheckCircleOutlined />,
}
const ATTENTION_TONES = { needs_review: 'orange', expired_jobs: 'red' }
const primaryLinkClass = 'inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg !bg-[var(--brand-primary)] px-3.5 text-sm font-semibold !text-white shadow-sm transition hover:!bg-[var(--brand-primary-hover)]'
const formatCount = (value) => (value || 0).toLocaleString(getIntlLocale())

export default function CampaignList() {
  const [searchParams, setSearchParams] = useSearchParams()
  const status = searchParams.get('status') || ''
  const scope = searchParams.get('scope') || ''
  const query = searchParams.get('q') || ''
  const ordering = searchParams.get('ordering') || DEFAULT_ORDERING
  const page = Math.max(Number(searchParams.get('page')) || 1, 1)
  const [searchValue, setSearchValue] = useState(query)
  const searchTimer = useRef(null)
  const { canAccessCandidateData } = useEmployerReadiness()
  const queryParams = useMemo(() => ({
    page,
    ordering,
    ...(status ? { status } : {}),
    ...(scope ? { scope } : {}),
    ...(query ? { q: query } : {}),
  }), [ordering, page, query, scope, status])
  const campaignsQuery = useQuery({
    queryKey: campaignKeys.list(queryParams),
    queryFn: () => getCampaigns(queryParams),
    // Keep the rows and tab counts on screen while the next tab/page loads.
    placeholderData: keepPreviousData,
  })
  const pageData = campaignsQuery.data || { count: 0, results: [] }
  const campaigns = pageData.results || []
  const counts = pageData.status_counts
  const attentionCounts = pageData.attention_counts
  const hasFilters = Boolean(status || scope || query)

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
    setSearchParams(searchParams.has('ordering') ? { ordering } : {})
  }

  const firstRow = (page - 1) * PAGE_SIZE + 1
  const lastRow = Math.min(page * PAGE_SIZE, pageData.count || 0)

  return (
    <section className="wt-page">
      <WorkspaceStatusTiles
        ariaLabel={m.employer_campaign_list_status_tabs_aria()}
        value={status}
        onChange={(value) => replaceFilters({ status: value })}
        items={CAMPAIGN_STATUS_TABS.map((tab) => ({
          key: tab.countKey,
          value: tab.value,
          label: tab.label,
          icon: STATUS_ICONS[tab.countKey],
          count: counts?.[tab.countKey] === undefined ? undefined : formatCount(counts[tab.countKey]),
        }))}
      />

      <div className="wt-table cpl-table">
        <div className="wt-toolbar">
          <WorkspaceQuickFilters
            label={m.employer_campaign_list_attention_label()}
            ariaLabel={m.employer_campaign_list_attention_aria()}
            items={CAMPAIGN_ATTENTION_SCOPES.map((item) => ({ ...item, tone: ATTENTION_TONES[item.value], count: attentionCounts?.[item.value] }))}
            value={scope}
            onChange={(value) => replaceFilters({ scope: value })}
            clearLabel={m.employer_campaign_list_clear_filters()}
            onClear={hasFilters ? clearFilters : undefined}
          />
          <div className="wt-filters">
            <Select
              size="large"
              aria-label={m.employer_campaign_list_sort_aria()}
              value={ordering}
              options={CAMPAIGN_ORDERING_OPTIONS}
              onChange={(value) => replaceFilters({ ordering: value === DEFAULT_ORDERING ? '' : value })}
            />
            <Input
              size="large"
              allowClear
              className="wt-filters__search"
              aria-label={m.employer_campaign_list_search_aria()}
              prefix={<SearchOutlined className="text-slate-400" aria-hidden />}
              placeholder={m.employer_campaign_list_search_placeholder()}
              type="search"
              value={searchValue}
              onChange={(event) => search(event.target.value)}
              onClear={() => search('', 0)}
              onPressEnter={() => search(searchValue, 0)}
            />
          </div>
        </div>

        <div className="wt-head">
          <span>{m.employer_campaign_list_col_campaign()}</span>
          <span>{m.employer_campaign_list_col_status()}</span>
          <span>{m.employer_campaign_jobs_col_job()}</span>
          <span>{m.employer_campaign_cv_col_candidate()}</span>
          <span>{m.employer_campaign_list_col_progress()}</span>
          <span>{m.employer_campaign_jobs_col_actions()}</span>
        </div>

        {campaignsQuery.isError && (
          <div className="p-3">
            <Alert
              type="error"
              showIcon
              title={getApiErrorMessage(campaignsQuery.error, m.employer_campaign_list_load_error())}
              action={<Button size="small" danger onClick={() => campaignsQuery.refetch()}>{m.employer_campaign_retry()}</Button>}
            />
          </div>
        )}

        {campaignsQuery.isLoading ? (
          <div aria-label={m.employer_campaign_list_loading_aria()}>
            {[1, 2, 3].map((item) => (
              <div key={item} className="wt-row">
                <Skeleton active title={{ width: '45%' }} paragraph={{ rows: 2, width: ['70%', '90%'] }} className="cpl-skeleton" />
              </div>
            ))}
          </div>
        ) : campaigns.length === 0 && !campaignsQuery.isError ? (
          hasFilters ? (
            <div className="wt-empty">
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={m.employer_campaign_list_empty_filtered()}>
                <Button onClick={clearFilters}>{m.employer_campaign_list_clear_filters()}</Button>
              </Empty>
            </div>
          ) : (
            <MascotEmpty className="py-12" description={m.employer_campaign_list_empty()}>
              <Link className={primaryLinkClass} to={employerAppPath('/campaigns/new')}>
                <PlusOutlined /> {m.employer_campaign_list_create_first()}
              </Link>
            </MascotEmpty>
          )
        ) : (
          <div
            aria-busy={campaignsQuery.isFetching}
            aria-live="polite"
            className={`transition-opacity ${campaignsQuery.isPlaceholderData ? 'opacity-60' : ''}`}
          >
            {campaigns.map((campaign) => (
              <CampaignListRow key={campaign.public_id} campaign={campaign} candidateDataAccess={canAccessCandidateData} />
            ))}
          </div>
        )}
      </div>

      {pageData.count > 0 && (
        <WorkspaceListFooter
          summary={m.employer_campaign_list_range({ first: firstRow, last: lastRow, total: formatCount(pageData.count) })}
          page={page}
          pageSize={PAGE_SIZE}
          total={pageData.count}
          onChange={(nextPage) => replaceFilters({ page: nextPage })}
        />
      )}
    </section>
  )
}
