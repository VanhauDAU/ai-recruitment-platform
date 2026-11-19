import { SearchOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Alert, Button, Card, Empty, Input, Pagination, Select, Table, Tag } from 'antd'
import dayjs from '@/shared/lib/dayjs'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import {
  CAMPAIGN_ORDERING_OPTIONS,
  CAMPAIGN_SCOPE_OPTIONS,
  CAMPAIGN_SETUP_STATUSES,
  CAMPAIGN_STATUS_COLORS,
  CAMPAIGN_STATUS_LABELS,
  CAMPAIGN_STATUS_TABS,
  campaignKeys,
  getCampaigns,
} from '@/entities/campaign/campaign'
import { useEmployerReadiness } from '@/entities/account/employer-profile'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { m } from '@/shared/config/i18n'
import { employerAppPath } from '@/shared/config/portals'
import CampaignCandidateSummary from './CampaignCandidates'
import CampaignJobsSummary from './CampaignJobsSummary'
import './campaign-list.css'

const PAGE_SIZE = 20
const detailPath = (campaign, suffix = '') => employerAppPath(`/campaigns/${campaign.public_id}${suffix}`)
const shortDate = (value) => (value ? dayjs(value).format('DD/MM/YYYY') : '')

function campaignPeriod(campaign) {
  const start = shortDate(campaign.start_date) || m.employer_campaign_list_on_launch()
  const end = campaign.is_continuous
    ? m.employer_campaign_list_continuous()
    : shortDate(campaign.target_date) || m.employer_campaign_list_no_end_date()
  return m.employer_campaign_list_period({ start, end })
}

// Mỗi dòng chỉ có một hành động: việc tiếp theo hợp lý nhất cho trạng thái đó.
function nextAction(campaign, candidateDataAccess) {
  if (CAMPAIGN_SETUP_STATUSES.includes(campaign.status)) {
    return { label: m.employer_campaign_list_action_setup(), to: detailPath(campaign, '/setup'), primary: true }
  }
  const unviewed = campaign.unviewed_count ?? campaign.unviewed_application_count ?? 0
  if (candidateDataAccess && unviewed > 0) {
    return { label: m.employer_campaign_list_action_view_new_cv({ count: unviewed }), to: detailPath(campaign, '?active_tab=apply_cv'), primary: true }
  }
  return { label: m.employer_campaign_list_action_open(), to: detailPath(campaign) }
}

function CampaignName({ campaign }) {
  return (
    <div className="cpl-name">
      <Link className="cpl-name__title" to={detailPath(campaign)}>{campaign.name}</Link>
      <div className="cpl-name__meta">
        <Tag color={CAMPAIGN_STATUS_COLORS[campaign.status]} className="!m-0">
          {CAMPAIGN_STATUS_LABELS[campaign.status]}
        </Tag>
        <span>{campaignPeriod(campaign)}</span>
      </div>
    </div>
  )
}

function NextActionButton({ campaign, candidateDataAccess }) {
  const action = nextAction(campaign, candidateDataAccess)
  return (
    <Link to={action.to}>
      <Button type={action.primary ? 'primary' : 'default'} size="small">{action.label}</Button>
    </Link>
  )
}

function LastActivity({ campaign }) {
  const occurredAt = campaign.last_activity?.occurred_at
  return (
    <div className="cpl-activity">
      <span>{campaign.last_activity?.label || m.employer_campaign_list_activity_fallback()}</span>
      <time>{occurredAt ? dayjs(occurredAt).format('HH:mm DD/MM/YYYY') : '—'}</time>
    </div>
  )
}

export default function CampaignList() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [searchValue, setSearchValue] = useState(searchParams.get('q') || '')
  const status = searchParams.get('status') || ''
  const scope = searchParams.get('scope') || ''
  const ordering = searchParams.get('ordering') || 'status'
  const page = Number(searchParams.get('page')) || 1
  const query = searchParams.get('q') || ''
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
  })
  const { canAccessCandidateData } = useEmployerReadiness()
  const pageData = campaignsQuery.data || { count: 0, results: [] }
  const campaigns = pageData.results || []
  const counts = pageData.status_counts || {}

  function replaceFilters(next) {
    const values = Object.fromEntries(searchParams)
    Object.entries(next).forEach(([key, value]) => {
      if (value) values[key] = String(value)
      else delete values[key]
    })
    if (!Object.hasOwn(next, 'page')) delete values.page
    setSearchParams(values)
  }

  const empty = (
    <Empty description={status || scope || query ? m.employer_campaign_list_empty_filtered() : m.employer_campaign_list_empty()} />
  )
  const columns = [
    { title: m.employer_campaign_list_col_campaign(), render: (_, campaign) => <CampaignName campaign={campaign} /> },
    { title: m.employer_campaign_jobs_col_job(), width: 280, render: (_, campaign) => <CampaignJobsSummary campaign={campaign} /> },
    {
      title: m.employer_campaign_cv_col_candidate(),
      width: 180,
      render: (_, campaign) => (
        <CampaignCandidateSummary campaign={campaign} candidateDataAccess={canAccessCandidateData} />
      ),
    },
    { title: m.employer_campaign_list_col_last_activity(), width: 190, render: (_, campaign) => <LastActivity campaign={campaign} /> },
    {
      title: '',
      width: 130,
      align: 'right',
      render: (_, campaign) => <NextActionButton campaign={campaign} candidateDataAccess={canAccessCandidateData} />,
    },
  ]

  return (
    <section className="cpl">
      <Card styles={{ body: { padding: 0 } }}>
        <nav className="cpl-tabs" aria-label={m.employer_campaign_list_status_tabs_aria()}>
          {CAMPAIGN_STATUS_TABS.map((tab) => (
            <button
              key={tab.countKey}
              type="button"
              aria-pressed={status === tab.value}
              className={`cpl-tab${status === tab.value ? ' is-active' : ''}`}
              onClick={() => replaceFilters({ status: tab.value })}
            >
              {tab.label}
              <span className="cpl-tab__count">{counts[tab.countKey] ?? 0}</span>
            </button>
          ))}
        </nav>
        <div className="cpl-filters">
          <Input
            allowClear
            value={searchValue}
            prefix={<SearchOutlined className="text-slate-400" />}
            placeholder={m.employer_campaign_list_search_placeholder()}
            onChange={(event) => setSearchValue(event.target.value)}
            onClear={() => replaceFilters({ q: '' })}
            onPressEnter={() => replaceFilters({ q: searchValue.trim() })}
          />
          <Select
            aria-label={m.employer_campaign_list_scope_aria()}
            value={scope}
            options={CAMPAIGN_SCOPE_OPTIONS}
            onChange={(value) => replaceFilters({ scope: value })}
          />
          <Select
            aria-label={m.employer_campaign_list_sort_aria()}
            value={ordering}
            options={CAMPAIGN_ORDERING_OPTIONS}
            onChange={(value) => replaceFilters({ ordering: value })}
          />
        </div>
      </Card>

      {campaignsQuery.isError && (
        <Alert
          type="error"
          showIcon
          title={getApiErrorMessage(campaignsQuery.error, m.employer_campaign_list_load_error())}
          action={<Button size="small" danger onClick={() => campaignsQuery.refetch()}>{m.employer_campaign_retry()}</Button>}
        />
      )}

      <div className="cpl-cards">
        {campaignsQuery.isLoading && <Card loading />}
        {!campaignsQuery.isLoading && campaigns.length === 0 && <Card>{empty}</Card>}
        {campaigns.map((campaign) => (
          <Card key={campaign.public_id} styles={{ body: { padding: 16 } }}>
            <CampaignName campaign={campaign} />
            <div className="cpl-card__grid">
              <CampaignJobsSummary campaign={campaign} />
              <CampaignCandidateSummary campaign={campaign} candidateDataAccess={canAccessCandidateData} />
            </div>
            <div className="cpl-card__foot">
              <LastActivity campaign={campaign} />
              <NextActionButton campaign={campaign} candidateDataAccess={canAccessCandidateData} />
            </div>
          </Card>
        ))}
        {pageData.count > PAGE_SIZE && (
          <Pagination
            align="center"
            current={page}
            pageSize={PAGE_SIZE}
            total={pageData.count}
            showSizeChanger={false}
            onChange={(nextPage) => replaceFilters({ page: nextPage })}
          />
        )}
      </div>

      <Card className="cpl-table" styles={{ body: { padding: 0 } }}>
        <Table
          rowKey="public_id"
          loading={campaignsQuery.isLoading}
          dataSource={campaigns}
          locale={{ emptyText: empty }}
          pagination={{
            current: page,
            pageSize: PAGE_SIZE,
            total: pageData.count,
            showSizeChanger: false,
            hideOnSinglePage: true,
            onChange: (nextPage) => replaceFilters({ page: nextPage }),
          }}
          scroll={{ x: 1000 }}
          columns={columns}
        />
      </Card>
    </section>
  )
}
