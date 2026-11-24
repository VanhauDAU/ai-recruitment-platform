import {
  DownloadOutlined,
  EyeOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Alert, Empty, Input, Select, Skeleton, Table, Tag } from 'antd'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import {
  applicationKeys,
  exportRecruiterApplications,
  getRecruiterApplicationPage,
  RECRUITER_APPLICATION_STATUSES,
  RECRUITER_APPLICATION_STATUS_LABELS,
} from '@/entities/application/application'
import { campaignKeys, getCampaignReport } from '@/entities/campaign/campaign'
import { getEmployerJobs, jobKeys } from '@/entities/job/job'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { employerAppPath } from '@/shared/config/portals'
import { message } from '@/shared/lib/toast'
import { getIntlLocale, m } from '@/shared/config/i18n'

const STATUS_COLORS = {
  submitted: 'blue',
  viewed: 'cyan',
  shortlisted: 'green',
  interviewed: 'purple',
  accepted: 'success',
  rejected: 'default',
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString(getIntlLocale(), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function CandidateCell({ application }) {
  const displayName = application.candidate_name || application.candidate_email || m.employer_campaign_cv_candidate_fallback()
  return (
    <div className="flex min-w-52 items-center gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--brand-primary-soft)] font-bold text-[var(--brand-primary-hover)]">
        {displayName.trim().charAt(0).toLocaleUpperCase(getIntlLocale())}
      </span>
      <div className="min-w-0">
        <p className="truncate font-semibold text-slate-800">{displayName}</p>
        <p className="mt-0.5 truncate text-xs text-slate-500">
          {application.candidate_email || '—'}
        </p>
      </div>
    </div>
  )
}

export default function CampaignApplyCvPanel({ publicId }) {
  const [keywordInput, setKeywordInput] = useState('')
  const [keyword, setKeyword] = useState('')
  const [job, setJob] = useState('')
  const [scope, setScope] = useState('')
  const [status, setStatus] = useState('')
  const [ordering, setOrdering] = useState('newest')
  const [page, setPage] = useState(1)
  const params = useMemo(() => ({
    campaign: publicId,
    latest: 1,
    page,
    page_size: 10,
    ordering,
    ...(keyword ? { q: keyword } : {}),
    ...(job ? { job } : {}),
    ...(scope ? { scope } : {}),
    ...(status ? { status } : {}),
  }), [job, keyword, ordering, page, publicId, scope, status])
  const applicationsQuery = useQuery({
    queryKey: applicationKeys.recruiterList(params),
    queryFn: () => getRecruiterApplicationPage(params),
  })
  const reportQuery = useQuery({
    queryKey: campaignKeys.report(publicId),
    queryFn: () => getCampaignReport(publicId),
  })
  const jobsQuery = useQuery({
    queryKey: jobKeys.employerList({ campaign: publicId }),
    queryFn: () => getEmployerJobs({ campaign: publicId, page_size: 60 }),
  })
  const exportMutation = useMutation({
    mutationFn: () => exportRecruiterApplications({
      ...params,
      page: undefined,
      page_size: undefined,
    }),
    onSuccess: ({ blob, filename }) => {
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = filename
      anchor.click()
      URL.revokeObjectURL(url)
    },
    onError: (error) => message.error(
      getApiErrorMessage(error, m.employer_campaign_cv_export_error()),
    ),
  })
  const pageData = applicationsQuery.data || { count: 0, results: [] }
  const applications = pageData.results || []
  const report = reportQuery.data || {}

  const resetFilters = () => {
    setKeywordInput('')
    setKeyword('')
    setJob('')
    setScope('')
    setStatus('')
    setOrdering('newest')
    setPage(1)
  }
  const updateFilter = (setter) => (value) => {
    setter(value)
    setPage(1)
  }

  return (
    <div>
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-4 lg:px-5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <span className="shrink-0 text-xs font-bold uppercase tracking-widest text-slate-500">{m.employer_campaign_cv_filters()}</span>
          <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(180px,1.35fr)_180px_190px_160px_180px]">
            <Input
              className="!h-10 !rounded-xl !border-slate-200 !bg-white"
              value={keywordInput}
              allowClear
              prefix={<SearchOutlined className="text-slate-400" />}
              placeholder={m.employer_campaign_cv_search_placeholder()}
              onChange={(event) => setKeywordInput(event.target.value)}
              onClear={() => updateFilter(setKeyword)('')}
              onPressEnter={() => updateFilter(setKeyword)(keywordInput.trim())}
            />
            <Select
              aria-label={m.employer_campaign_cv_filter_job_aria()}
              value={job}
              options={[
                { value: '', label: m.employer_campaign_cv_all_jobs() },
                ...(jobsQuery.data || []).map((item) => ({
                  value: item.public_id,
                  label: item.title || m.employer_campaign_untitled_job(),
                })),
              ]}
              onChange={updateFilter(setJob)}
              className="[&_.ant-select-selector]:!rounded-xl"
            />
            <Select
              aria-label={m.employer_campaign_cv_filter_scope_aria()}
              value={scope}
              options={[
                { value: '', label: m.employer_campaign_cv_scope_all() },
                { value: 'unread', label: m.employer_campaign_cv_scope_unread() },
                { value: 'unanswered', label: m.employer_campaign_cv_scope_unanswered() },
              ]}
              onChange={updateFilter(setScope)}
              className="[&_.ant-select-selector]:!rounded-xl"
            />
            <Select
              aria-label={m.employer_campaign_cv_filter_status_aria()}
              value={status}
              options={[
                { value: '', label: m.employer_campaign_jobs_all_statuses() },
                ...RECRUITER_APPLICATION_STATUSES.map(([value, text]) => ({
                  value,
                  label: text,
                })),
              ]}
              onChange={updateFilter(setStatus)}
              className="[&_.ant-select-selector]:!rounded-xl"
            />
            <Select
              aria-label={m.employer_campaign_cv_sort_aria()}
              value={ordering}
              options={[
                { value: 'newest', label: m.employer_campaign_cv_sort_newest() },
                { value: 'oldest', label: m.employer_campaign_cv_sort_oldest() },
                { value: 'name', label: m.employer_campaign_cv_sort_name() },
              ]}
              onChange={updateFilter(setOrdering)}
              className="[&_.ant-select-selector]:!rounded-xl"
            />
          </div>
          <button
            type="button"
            className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-medium text-slate-500 transition hover:bg-white hover:text-[var(--brand-primary-hover)]"
            onClick={resetFilters}
          >
            <ReloadOutlined /> {m.employer_campaign_cv_reset()}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between lg:px-5">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="mr-1 font-semibold text-slate-700">
            {m.employer_campaign_cv_found({ count: pageData.count || 0 })}
          </span>
          <button
            type="button"
            aria-pressed={scope === 'unread'}
            className={`rounded-full border px-3 py-1.5 text-slate-600 transition ${scope === 'unread' ? 'border-[var(--brand-primary)]/20 bg-[var(--brand-primary-soft)] text-[var(--brand-primary-hover)]' : 'border-transparent bg-slate-100 hover:bg-slate-200'}`}
            onClick={() => updateFilter(setScope)('unread')}
          >
            {m.employer_campaign_cv_scope_unread()} <strong>{report.unviewed_count || 0}</strong>
          </button>
          <button
            type="button"
            aria-pressed={scope === 'unanswered'}
            className={`rounded-full border px-3 py-1.5 text-slate-600 transition ${scope === 'unanswered' ? 'border-[var(--brand-primary)]/20 bg-[var(--brand-primary-soft)] text-[var(--brand-primary-hover)]' : 'border-transparent bg-slate-100 hover:bg-slate-200'}`}
            onClick={() => updateFilter(setScope)('unanswered')}
          >
            {m.employer_campaign_cv_scope_unanswered()} <strong>{report.unanswered_count || 0}</strong>
          </button>
        </div>
        <button
          type="button"
          disabled={!pageData.count || exportMutation.isPending}
          className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-[var(--brand-primary)]/20 bg-[var(--brand-primary-soft)] px-4 text-sm font-semibold text-[var(--brand-primary-hover)] shadow-sm transition hover:border-[var(--brand-primary)]/40 hover:bg-[var(--brand-primary-soft)] disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400"
          onClick={() => exportMutation.mutate()}
        >
          <DownloadOutlined /> {m.employer_campaign_cv_export()}
        </button>
      </div>

      {applicationsQuery.isError ? (
        <Alert
          className="m-4"
          type="error"
          showIcon
          message={m.employer_campaign_cv_load_error()}
          description={getApiErrorMessage(applicationsQuery.error, m.employer_campaign_try_again_later())}
          action={(
            <button
              type="button"
              className="font-semibold text-red-700"
              onClick={() => applicationsQuery.refetch()}
            >
              {m.employer_campaign_retry()}
            </button>
          )}
        />
      ) : applicationsQuery.isLoading ? (
        <Skeleton active className="p-6" paragraph={{ rows: 6 }} />
      ) : (
        <div className="overflow-x-auto">
          <Table
            rowKey="public_id"
            dataSource={applications}
            pagination={{
              current: page,
              pageSize: 10,
              total: pageData.count,
              showSizeChanger: false,
              onChange: setPage,
            }}
            scroll={{ x: 1040 }}
            locale={{
              emptyText: (
                <Empty
                  className="py-16"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={<span className="text-slate-500">{m.employer_campaign_cv_empty()}</span>}
                />
              ),
            }}
            columns={[
              {
                title: m.employer_campaign_cv_col_candidate(),
                render: (_, application) => <CandidateCell application={application} />,
              },
              {
                title: m.employer_campaign_jobs_col_job(),
                dataIndex: 'job_title',
                render: (value) => (
                  <span className="block min-w-44 text-slate-700">{value || '—'}</span>
                ),
              },
              {
                title: m.employer_campaign_cv_col_submitted_cv(),
                render: (_, application) => (
                  <span className="block min-w-36 text-slate-700">
                    {application.submitted_cv_title || application.cv_title || m.employer_campaign_cv_default_title()}
                  </span>
                ),
              },
              {
                title: m.employer_campaign_cv_col_applied_at(),
                render: (_, application) => (
                  <span className="whitespace-nowrap text-slate-600">
                    {formatDate(application.applied_at)}
                  </span>
                ),
              },
              {
                title: m.employer_campaign_cv_col_status(),
                render: (_, application) => (
                  <Tag color={STATUS_COLORS[application.status]}>
                    {RECRUITER_APPLICATION_STATUS_LABELS[application.status]
                      || application.status}
                  </Tag>
                ),
              },
              {
                title: '',
                align: 'right',
                render: (_, application) => (
                  <Link
                    to={employerAppPath(`/applications?campaign=${publicId}&application=${application.public_id}`)}
                    className="inline-flex items-center gap-1 whitespace-nowrap font-semibold !text-[var(--brand-primary-hover)]"
                  >
                    <EyeOutlined /> {m.employer_campaign_cv_details()}
                  </Link>
                ),
              },
            ]}
          />
        </div>
      )}
    </div>
  )
}
