import {
  EditOutlined,
  ExportOutlined,
  FileSearchOutlined,
  InfoCircleOutlined,
  LineChartOutlined,
  PlusOutlined,
} from '@ant-design/icons'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Alert, Button, Empty, Select, Skeleton, Table, Tag, Tooltip } from 'antd'
import { useRef, useState } from 'react'
import { Link } from 'react-router'
import {
  campaignKeys,
  getCampaignJobPerformance,
} from '@/entities/campaign/campaign'
import { jobDetailPath } from '@/entities/job/job'
import { employerAppPath } from '@/shared/config/portals'
import CampaignPerformanceChart from './CampaignPerformanceChart'
import { getIntlLocale, m } from '@/shared/config/i18n'

const JOB_STATUS = {
  draft: [m.employer_campaign_jobs_status_draft(), 'default'],
  active: [m.employer_campaign_jobs_status_active(), 'green'],
  closed: [m.employer_campaign_jobs_status_closed(), 'default'],
}

const RANGE_OPTIONS = [
  { value: 7, label: m.employer_campaign_range_7() },
  { value: 30, label: m.employer_campaign_range_30() },
  { value: 90, label: m.employer_campaign_range_90() },
]

function numberValue(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function formatNumber(value) {
  return numberValue(value).toLocaleString(getIntlLocale())
}

function formatDate(value) {
  if (!value) return m.employer_campaign_jobs_no_deadline()
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? m.employer_campaign_jobs_no_deadline() : date.toLocaleDateString(getIntlLocale())
}

function formatRate(value) {
  if (value == null) return '—'
  return `${numberValue(value).toLocaleString(getIntlLocale(), { maximumFractionDigits: 2 })}%`
}

function JobStatus({ job, campaignPaused = false }) {
  if (job.status === 'active' && job.visibility_held) {
    return (
      <Tooltip title={m.employer_campaign_jobs_held_tooltip()}>
        <Tag color="red">{m.employer_campaign_jobs_hidden()}</Tag>
      </Tooltip>
    )
  }
  if (job.is_expired) return <Tag color="orange">{m.employer_campaign_jobs_expired()}</Tag>
  if (campaignPaused && job.status === 'active') {
    return (
      <Tooltip title={m.employer_campaign_jobs_paused_tooltip()}>
        <Tag color="orange">
          <span className="sr-only">{m.employer_campaign_jobs_hidden_by_campaign()}</span>
          <span aria-hidden>{m.employer_campaign_jobs_hidden()}</span>
        </Tag>
      </Tooltip>
    )
  }
  const [label, color] = JOB_STATUS[job.status] || [job.status, 'default']
  return <Tag color={color}>{label}</Tag>
}

function JobActions({
  job,
  onViewReport,
  reportSelected = false,
  campaignPaused = false,
}) {
  const canViewPublicJob = job.status === 'active'
    && Boolean(job.slug)
    && !campaignPaused
    && !job.visibility_held
  const actionClassName = 'inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 bg-white !text-slate-600 shadow-sm transition hover:border-[var(--brand-primary)] hover:bg-[var(--brand-primary-soft)] hover:!text-[var(--brand-primary-hover)]'

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-label={m.employer_campaign_jobs_view_report_aria({ title: job.title || m.employer_campaign_jobs_untitled_fallback() })}
        aria-pressed={reportSelected}
        onClick={() => onViewReport(job)}
        className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold shadow-sm transition ${reportSelected ? 'border-[var(--brand-primary)] bg-[var(--brand-primary-soft)] text-[var(--brand-primary-hover)]' : 'border-slate-300 bg-white text-slate-600 hover:border-[var(--brand-primary)] hover:bg-[var(--brand-primary-soft)] hover:text-[var(--brand-primary-hover)]'}`}
      >
        <LineChartOutlined />
        {reportSelected ? m.employer_campaign_jobs_viewing() : m.employer_campaign_jobs_view_report()}
      </button>
      <Tooltip
        title={
          canViewPublicJob
            ? m.employer_campaign_jobs_view_public()
            : campaignPaused
              ? m.employer_campaign_paused_title()
              : m.employer_campaign_jobs_not_public()
        }
      >
        <a
          aria-label={m.employer_campaign_jobs_view_public_aria({ title: job.title || m.employer_campaign_jobs_untitled_fallback() })}
          href={canViewPublicJob ? jobDetailPath(job) : undefined}
          target={canViewPublicJob ? '_blank' : undefined}
          rel={canViewPublicJob ? 'noopener noreferrer' : undefined}
          aria-disabled={!canViewPublicJob}
          onClick={(event) => {
            if (!canViewPublicJob) event.preventDefault()
          }}
          className={`${actionClassName} ${canViewPublicJob ? '' : 'cursor-not-allowed border-slate-200 bg-slate-100 !text-slate-300 hover:border-slate-200 hover:bg-slate-100 hover:!text-slate-300'}`}
        >
          <ExportOutlined />
        </a>
      </Tooltip>
      {!job.visibility_held && (
        <Tooltip title={m.employer_campaign_jobs_edit()}>
          <Link
            aria-label={m.employer_campaign_jobs_edit_aria({ title: job.title || m.employer_campaign_jobs_untitled_fallback() })}
            to={employerAppPath(`/tin-tuyen-dung/${job.public_id}/chinh-sua`)}
            className={actionClassName}
          >
            <EditOutlined />
          </Link>
        </Tooltip>
      )}
    </div>
  )
}

function MetricValue({ value, available = true }) {
  if (!available) {
    return <Tooltip title={m.employer_campaign_jobs_no_tracking()}><span className="text-slate-400">—</span></Tooltip>
  }
  return formatNumber(value)
}

function AddJobButton({ publicId }) {
  return (
    <Link
      to={employerAppPath(`/tin-tuyen-dung/tao-moi?campaign=${publicId}`)}
      className="inline-flex h-10 shrink-0 items-center rounded-xl px-4 text-sm font-semibold !text-white shadow-md transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)]/25 focus-visible:ring-offset-2"
      style={{ backgroundColor: 'var(--brand-primary)', color: '#fff' }}
    >
      <PlusOutlined aria-hidden className="mr-2" /> {m.employer_campaign_jobs_add()}
    </Link>
  )
}

function PausedCampaignAlert({ campaign }) {
  if (campaign?.status !== 'paused') return null
  return (
    <Alert
      className="mb-4"
      type="warning"
      showIcon
      title={m.employer_campaign_paused_title()}
      description={m.employer_campaign_jobs_paused_description()}
    />
  )
}

export default function CampaignJobsPanel({
  publicId,
  campaign,
  candidateDataAccess = false,
}) {
  const reportSectionRef = useRef(null)
  const [days, setDays] = useState(7)
  const [jobPublicId, setJobPublicId] = useState('')
  const [status, setStatus] = useState('')
  const performanceQuery = useQuery({
    queryKey: campaignKeys.jobPerformance(publicId, days, jobPublicId),
    queryFn: () => getCampaignJobPerformance(publicId, days, jobPublicId),
    enabled: Boolean(publicId),
    placeholderData: keepPreviousData,
  })
  const performance = performanceQuery.data
  const jobs = performance?.jobs || []
  const visibleJobs = status === 'expired'
    ? jobs.filter((job) => job.is_expired)
    : status === 'active'
      ? jobs.filter((job) => job.status === status && !job.is_expired)
      : status
        ? jobs.filter((job) => job.status === status)
        : jobs
  const selectedJob = jobs.find((job) => job.public_id === jobPublicId)
  const isReportUpdating = performanceQuery.isFetching && performanceQuery.isPlaceholderData
  const isPeriodUpdating = isReportUpdating && performance?.range?.days !== days
  const viewJobReport = (job) => {
    setJobPublicId(job.public_id)
    reportSectionRef.current?.scrollIntoView?.({ block: 'start' })
  }

  if (performanceQuery.isLoading) {
    return (
      <div className="px-4 py-5 lg:px-5">
        <PausedCampaignAlert campaign={campaign} />
        <div className="flex justify-end border-b border-slate-200 pb-4"><AddJobButton publicId={publicId} /></div>
        <Skeleton active className="pt-5" paragraph={{ rows: 9 }} />
      </div>
    )
  }

  if (performanceQuery.isError) {
    return (
      <div className="px-4 py-5 lg:px-5">
        <PausedCampaignAlert campaign={campaign} />
        <div className="flex justify-end border-b border-slate-200 pb-4"><AddJobButton publicId={publicId} /></div>
        <div className="py-16 text-center">
          <FileSearchOutlined className="text-4xl text-slate-300" />
          <p className="mt-3 font-semibold text-slate-700">{m.employer_campaign_jobs_load_error()}</p>
          <div className="mt-3 flex flex-wrap justify-center gap-3">
            {jobPublicId && (
              <button type="button" className="text-sm font-semibold text-slate-600" onClick={() => setJobPublicId('')}>
                {m.employer_campaign_jobs_view_all()}
              </button>
            )}
            <button type="button" className="text-sm font-semibold text-[var(--brand-primary-hover)]" onClick={() => performanceQuery.refetch()}>{m.employer_campaign_retry()}</button>
          </div>
        </div>
      </div>
    )
  }

  if (!jobs.length) {
    return (
      <div className="px-4 py-5 lg:px-5">
        <PausedCampaignAlert campaign={campaign} />
        <div className="flex justify-end border-b border-slate-200 pb-4"><AddJobButton publicId={publicId} /></div>
        <Empty className="py-20" image={Empty.PRESENTED_IMAGE_SIMPLE} description={m.employer_campaign_jobs_empty()} />
      </div>
    )
  }

  return (
    <div ref={reportSectionRef} className="px-4 py-5 lg:px-5">
      <PausedCampaignAlert campaign={campaign} />
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4 text-sm text-slate-700">
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <span className="font-semibold">{m.employer_campaign_jobs_report_label()}</span>
            {selectedJob ? (
              <Link to={employerAppPath(`/tin-tuyen-dung/${selectedJob.public_id}`)} className="truncate font-semibold !text-[var(--brand-primary-hover)] hover:underline">
                {selectedJob.title || m.employer_campaign_untitled_draft()}
              </Link>
            ) : (
              <span className="font-semibold text-[var(--brand-primary-hover)]">{m.employer_campaign_jobs_all_in_campaign({ count: jobs.length })}</span>
            )}
          </div>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            {selectedJob
              ? m.employer_campaign_jobs_scope_selected()
              : m.employer_campaign_jobs_scope_all({ count: jobs.length })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {selectedJob && (
            <Button onClick={() => setJobPublicId('')}>
              {m.employer_campaign_jobs_view_summary()}
            </Button>
          )}
          <AddJobButton publicId={publicId} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 py-4 lg:grid-cols-5" aria-busy={isReportUpdating}>
        {[
          [m.employer_campaign_metric_impressions(), performance.summary?.impressions],
          [m.employer_campaign_metric_views(), performance.summary?.views],
          [m.employer_campaign_metric_applications(), performance.summary?.applications],
          [m.employer_campaign_metric_view_rate(), formatRate(performance.summary?.view_rate)],
          [m.employer_campaign_metric_application_rate(), formatRate(performance.summary?.application_rate)],
        ].map(([label, value], index) => (
          <article key={label} className={`rounded-xl border border-slate-100 bg-slate-50 p-3.5 ${index === 4 ? 'col-span-2 lg:col-span-1' : ''}`}>
            <p className="text-xs text-slate-500">{label}</p>
            <strong className="mt-1 block text-lg text-slate-800">
              {isReportUpdating
                ? <Skeleton.Input active size="small" className="!h-6 !w-16" />
                : typeof value === 'number' ? formatNumber(value) : value ?? '—'}
            </strong>
          </article>
        ))}
      </div>

      <div className="grid gap-5 py-4 xl:grid-cols-[minmax(0,1fr)_280px]">
        <section className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50 p-3.5 sm:p-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              <Select
                aria-label={m.employer_campaign_jobs_range_aria()}
                data-testid="campaign-performance-range"
                value={days}
                onChange={setDays}
                options={RANGE_OPTIONS}
                className="w-36"
              />
            </div>
            <span className="hidden items-center gap-1.5 text-xs text-slate-400 sm:inline-flex"><LineChartOutlined /> {m.employer_campaign_jobs_daily()}</span>
          </div>
          <div aria-busy={isReportUpdating}>
            {isReportUpdating
              ? <Skeleton active title={false} paragraph={{ rows: 6 }} />
              : <CampaignPerformanceChart data={performance.daily || []} />}
          </div>
        </section>

        <aside className="self-start rounded-2xl border border-[var(--brand-primary)]/20 bg-gradient-to-br from-[var(--brand-primary-soft)] to-white p-4 shadow-sm">
          <p className="text-sm leading-6 text-slate-600">
            <strong className="text-slate-800">{m.employer_campaign_jobs_48h()}</strong>{m.employer_campaign_jobs_48h_tip()}
          </p>
          {candidateDataAccess && (
            <Link
              to={employerAppPath(`/ho-so-ung-tuyen?campaign=${publicId}`)}
              className="mt-4 inline-flex h-9 items-center gap-2 rounded bg-[var(--brand-primary-soft)] px-3 text-sm font-semibold !text-[var(--brand-primary-hover)] hover:bg-[var(--brand-primary-soft)]"
            >
              <FileSearchOutlined /> {m.employer_campaign_jobs_check_cv()}
            </Link>
          )}
        </aside>
      </div>

      <div className="mt-1 flex flex-col gap-3 rounded-t-2xl border border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-800">{m.employer_campaign_jobs_table_title()}</h3>
          <p className="mt-0.5 text-xs text-slate-400">{m.employer_campaign_jobs_table_description()}</p>
        </div>
        <Select
          aria-label={m.employer_campaign_jobs_status_filter_aria()}
          value={status}
          onChange={setStatus}
          className="w-full sm:w-40"
          options={[
            { value: '', label: m.employer_campaign_jobs_all_statuses() },
            ...Object.entries(JOB_STATUS).map(([value, [label]]) => ({ value, label })),
            { value: 'expired', label: m.employer_campaign_jobs_expired() },
          ]}
        />
      </div>
      <div className="overflow-x-auto rounded-b-2xl border border-t-0 border-slate-200" data-testid="campaign-performance-table">
        <Table
          rowKey="public_id"
          dataSource={visibleJobs}
          loading={isPeriodUpdating}
          pagination={false}
          scroll={{ x: 1120 }}
          columns={[
            {
              title: m.employer_campaign_jobs_col_actions(),
              width: 250,
              render: (_, job) => (
                <JobActions
                  job={job}
                  campaignPaused={campaign?.status === 'paused'}
                  onViewReport={viewJobReport}
                  reportSelected={job.public_id === jobPublicId}
                />
              ),
            },
            {
              title: m.employer_campaign_jobs_col_job(),
              width: 250,
              render: (_, job) => (
                <div className="min-w-48">
                  <Link className="font-semibold !text-[var(--brand-primary-hover)] hover:underline" to={employerAppPath(`/tin-tuyen-dung/${job.public_id}`)}>{job.title || m.employer_campaign_untitled_draft()}</Link>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5"><JobStatus job={job} campaignPaused={campaign?.status === 'paused'} /><span className="text-xs text-slate-400">{m.employer_campaign_jobs_deadline({ date: formatDate(job.deadline) })}</span></div>
                </div>
              ),
            },
            {
              title: m.employer_campaign_jobs_col_impressions(),
              align: 'right',
              render: (_, job) => <MetricValue value={job.impressions} available={job.available} />,
            },
            {
              title: m.employer_campaign_jobs_col_views(),
              align: 'right',
              render: (_, job) => <MetricValue value={job.views} available={job.available} />,
            },
            {
              title: <Tooltip title={m.employer_campaign_jobs_view_rate_formula()}><span>{m.employer_campaign_jobs_col_view_rate()} <InfoCircleOutlined /></span></Tooltip>,
              align: 'right',
              render: (_, job) => <strong className="text-slate-700">{formatRate(job.view_rate)}</strong>,
            },
            {
              title: m.employer_campaign_jobs_col_applications(),
              align: 'right',
              render: (_, job) => (
                job.available && candidateDataAccess
                  ? <Link to={employerAppPath(`/ho-so-ung-tuyen?job=${job.public_id}`)} className="font-semibold !text-[var(--brand-primary-hover)]">{formatNumber(job.applications)}</Link>
                  : <span className={job.available ? 'font-semibold text-slate-700' : 'text-slate-400'}>{job.available ? formatNumber(job.applications) : '—'}</span>
              ),
            },
            {
              title: <Tooltip title={m.employer_campaign_jobs_application_rate_formula()}><span>{m.employer_campaign_jobs_col_application_rate()} <InfoCircleOutlined /></span></Tooltip>,
              align: 'right',
              render: (_, job) => <strong className="text-slate-700">{formatRate(job.application_rate)}</strong>,
            },
          ]}
        />
      </div>

      <div className="mt-3 space-y-1 text-xs leading-5 text-slate-500">
        <p><InfoCircleOutlined className="mr-1.5" />{m.employer_campaign_jobs_note_data_from({ date: formatDate(performance.data_available_from) })}</p>
        <p>{m.employer_campaign_jobs_note_analytics()}</p>
        <p>{m.employer_campaign_jobs_note_delay()}</p>
      </div>
    </div>
  )
}
