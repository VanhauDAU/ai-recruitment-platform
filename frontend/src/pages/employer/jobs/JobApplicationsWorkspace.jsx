import { ArrowRightOutlined, DownloadOutlined, ExportOutlined, SearchOutlined } from '@ant-design/icons'
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query'
import { Alert, Button, Empty, Input, Pagination, Select, Skeleton, Table, Tooltip } from 'antd'
import dayjs from '@/shared/lib/dayjs'
import { useState } from 'react'
import { Link } from 'react-router'
import {
  APPLICATION_STATUS_TONES,
  applicationKeys,
  exportRecruiterApplications,
  getRecruiterApplicationPage,
  RECRUITER_APPLICATION_STATUS_LABELS,
} from '@/entities/application/application'
import { FitScoreChip } from '@/entities/application/job-fit'
import { useSiteSettings } from '@/entities/system/site-settings'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { employerAppPath } from '@/shared/config/portals'
import useDebouncedValue from '@/shared/hooks/use-debounced-value'
import { triggerBlobDownload } from '@/shared/lib/download-blob'
import { message } from '@/shared/lib/toast'
import { MascotEmpty } from '@/shared/ui/mascot'
import {
  applicationFilterChips,
  applicationFilterParams,
  formatRelativeDay,
} from './job-detail-presentation'
import { candidateInitials, formatCount } from './job-list-presentation'
import { m } from '@/shared/config/i18n'

const PAGE_SIZE = 10
const ORDERING_OPTIONS = [
  { value: 'newest', label: m.employer_job_cv_sort_newest() },
  { value: 'oldest', label: m.employer_job_cv_sort_oldest() },
  { value: 'name', label: m.employer_job_cv_sort_name() },
]
const AI_ORDERING_OPTION = { value: 'ai_match', label: m.employer_job_cv_sort_ai_match() }
// Cách sắp xếp nhà tuyển dụng chọn lần trước; mặc định vẫn là mới nhất.
const ORDERING_STORAGE_KEY = 'procv_employer_cv_ordering'

function storedOrdering() {
  try {
    return window.localStorage.getItem(ORDERING_STORAGE_KEY) || 'newest'
  } catch {
    return 'newest'
  }
}

function storeOrdering(value) {
  try {
    window.localStorage.setItem(ORDERING_STORAGE_KEY, value)
  } catch {
    // Trình duyệt chặn lưu: chỉ mất việc nhớ lựa chọn.
  }
}

function Fit({ application }) {
  return (
    <FitScoreChip
      status={application.ai_match_status}
      score={application.ai_match_score}
      level={application.ai_match_level}
    />
  )
}

function StatusPill({ status }) {
  return (
    <span className={`ws-pill ws-pill--status ws-tone-${APPLICATION_STATUS_TONES[status] || 'slate'}`}>
      {RECRUITER_APPLICATION_STATUS_LABELS[status] || status}
    </span>
  )
}

function Candidate({ application }) {
  const name = application.candidate_name || application.candidate_email || m.employer_job_cv_candidate_fallback()
  const isNew = application.status === 'submitted'
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
        {candidateInitials(name)}
        {isNew && <span aria-label={m.employer_job_cv_new_application()} className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-orange-500" />}
      </span>
      <div className="min-w-0">
        <p className={`truncate text-sm text-slate-900 ${isNew ? 'font-bold' : 'font-semibold'}`}>{name}</p>
        <p className="truncate text-xs text-slate-500">{application.candidate_email}</p>
      </div>
    </div>
  )
}

function AppliedAt({ value }) {
  return (
    <Tooltip title={value ? dayjs(value).format('HH:mm DD/MM/YYYY') : null}>
      <span className="whitespace-nowrap text-sm text-slate-600">{formatRelativeDay(value)}</span>
    </Tooltip>
  )
}

export default function JobApplicationsWorkspace({ jobPublicId, summary, filter, onFilterChange, publicUrl }) {
  const [keywordInput, setKeywordInput] = useState('')
  const keyword = useDebouncedValue(keywordInput.trim(), 400)
  const rankingEnabled = useSiteSettings().settings.ai_application_ranking_enabled === true
  const [chosenOrdering, setChosenOrdering] = useState(storedOrdering)
  // Lựa chọn "Phù hợp nhất" đã lưu không còn hiệu lực khi tính năng tắt.
  const ordering = chosenOrdering === 'ai_match' && !rankingEnabled ? 'newest' : chosenOrdering
  const orderingOptions = rankingEnabled ? [AI_ORDERING_OPTION, ...ORDERING_OPTIONS] : ORDERING_OPTIONS
  // The page belongs to one filter combination, so any filter change starts at page 1.
  const signature = `${filter}|${keyword}|${ordering}`
  const [pageState, setPageState] = useState({ signature, page: 1 })
  const page = pageState.signature === signature ? pageState.page : 1
  const filterParams = {
    job: jobPublicId,
    latest: 1,
    ordering,
    ...(keyword ? { q: keyword } : {}),
    ...applicationFilterParams(filter),
  }
  const params = { ...filterParams, page, page_size: PAGE_SIZE }
  const applicationsQuery = useQuery({
    queryKey: applicationKeys.recruiterList(params),
    queryFn: () => getRecruiterApplicationPage(params),
    placeholderData: keepPreviousData,
  })
  const exportMutation = useMutation({
    mutationFn: () => exportRecruiterApplications(filterParams),
    onSuccess: ({ blob, filename }) => triggerBlobDownload(blob, filename),
    onError: (error) => message.error(getApiErrorMessage(error, m.employer_job_cv_export_failed())),
  })
  const pageData = applicationsQuery.data || { count: 0, results: [] }
  const applications = pageData.results || []
  const chips = applicationFilterChips(summary, filter)

  function manageUrl(application) {
    const query = new URLSearchParams({ job: jobPublicId })
    if (application?.candidate_email) query.set('q', application.candidate_email)
    if (application?.public_id) query.set('application', application.public_id)
    return employerAppPath(`/applications?${query}`)
  }

  function changeOrdering(value) {
    setChosenOrdering(value)
    storeOrdering(value)
  }

  function resetFilters() {
    setKeywordInput('')
    onFilterChange('all')
  }

  if (!summary.total && !applicationsQuery.isLoading && !applications.length) {
    return (
      <MascotEmpty className="py-12" size={128} description={m.employer_job_cv_empty()}>
        {publicUrl && (
          <Button href={publicUrl} target="_blank" rel="noopener noreferrer" icon={<ExportOutlined />}>
            {m.employer_job_cv_view_posting()}
          </Button>
        )}
      </MascotEmpty>
    )
  }

  const columns = [
    { title: m.employer_job_cv_col_candidate(), key: 'candidate', render: (_, item) => <Candidate application={item} /> },
    {
      title: m.employer_job_cv_col_cv(),
      key: 'cv',
      render: (_, item) => (
        <span className="line-clamp-1 text-sm text-slate-700">{item.submitted_cv_title || item.cv_title || m.employer_job_cv_cv_fallback()}</span>
      ),
    },
    ...(rankingEnabled
      ? [{ title: m.employer_job_cv_col_fit(), key: 'fit', width: 190, render: (_, item) => <Fit application={item} /> }]
      : []),
    { title: m.employer_job_cv_col_status(), key: 'status', width: 150, render: (_, item) => <StatusPill status={item.status} /> },
    { title: m.employer_job_cv_col_applied_at(), key: 'applied_at', width: 130, render: (_, item) => <AppliedAt value={item.applied_at} /> },
    {
      title: <span className="sr-only">{m.employer_job_cv_col_actions()}</span>,
      key: 'action',
      width: 120,
      align: 'right',
      render: (_, item) => (
        <Link to={manageUrl(item)} className="inline-flex items-center gap-1 whitespace-nowrap text-sm font-semibold !text-[var(--brand-primary-hover)] hover:!text-[var(--brand-primary)]">
          {m.employer_job_cv_view_application()} <ArrowRightOutlined aria-hidden className="text-[10px]" />
        </Link>
      ),
    },
  ]

  return (
    <div className="min-w-0">
      <div className="job-cv-toolbar px-4 pt-4 sm:px-5">
        <Input
          allowClear
          aria-label={m.employer_job_cv_search_aria()}
          prefix={<SearchOutlined className="text-slate-400" aria-hidden />}
          placeholder={m.employer_job_cv_search_placeholder()}
          value={keywordInput}
          onChange={(event) => setKeywordInput(event.target.value)}
        />
        <Select
          aria-label={m.employer_job_cv_sort_aria()}
          className="min-w-0"
          value={ordering}
          options={orderingOptions}
          onChange={changeOrdering}
        />
        <Tooltip title={m.employer_job_cv_export_tooltip()}>
          <Button
            aria-label={m.employer_job_cv_export_aria()}
            icon={<DownloadOutlined />}
            disabled={!pageData.count}
            loading={exportMutation.isPending}
            onClick={() => exportMutation.mutate()}
          />
        </Tooltip>
        <Link
          to={manageUrl()}
          className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 px-3 text-sm font-semibold !text-slate-700 transition hover:border-[var(--brand-primary)]/40 hover:!text-[var(--brand-primary-hover)]"
        >
          {m.employer_job_cv_manage()} <ArrowRightOutlined aria-hidden className="text-[10px]" />
        </Link>
      </div>

      <div
        role="group"
        aria-label={m.employer_job_cv_filter_aria()}
        className="job-strip gap-2 px-4 py-3 sm:flex-wrap sm:px-5"
      >
        {chips.map((chip) => {
          const active = chip.key === filter
          return (
            <button
              key={chip.key}
              type="button"
              aria-pressed={active}
              title={chip.key === 'submitted' ? m.employer_job_cv_submitted_hint() : undefined}
              onClick={() => onFilterChange(chip.key)}
              className="job-chip"
            >
              {chip.tone && <span aria-hidden className={`ws-dot ws-tone-${chip.tone}`} />}
              {chip.label}
              <span>{formatCount(chip.count)}</span>
            </button>
          )
        })}
      </div>

      {ordering === 'ai_match' && (
        <p className="px-4 pb-3 text-xs leading-5 text-slate-500 sm:px-5">{m.employer_job_cv_fit_order_note()}</p>
      )}

      {applicationsQuery.isError ? (
        <div className="px-4 pb-4 sm:px-5">
          <Alert
            type="error"
            showIcon
            title={m.employer_job_cv_load_failed({ reason: getApiErrorMessage(applicationsQuery.error, m.employer_job_cv_try_later()) })}
            action={<Button size="small" danger onClick={() => applicationsQuery.refetch()}>{m.employer_job_cv_retry()}</Button>}
          />
        </div>
      ) : applicationsQuery.isLoading ? (
        <div className="px-4 pb-5 sm:px-5" aria-label={m.employer_job_cv_loading_aria()}>
          <Skeleton active avatar paragraph={{ rows: 3 }} />
        </div>
      ) : applications.length === 0 ? (
        <div className="py-10">
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={m.employer_job_cv_no_match()}>
            <Button onClick={resetFilters}>{m.employer_job_cv_clear_filters()}</Button>
          </Empty>
        </div>
      ) : (
        <div className={applicationsQuery.isPlaceholderData ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
          <div className="hidden border-t border-slate-100 md:block">
            <Table
              rowKey="public_id"
              size="middle"
              dataSource={applications}
              columns={columns}
              pagination={false}
              className="job-cv-table"
            />
          </div>
          <ul className="list-none divide-y divide-slate-100 border-t border-slate-100 p-0 md:hidden">
            {applications.map((application) => (
              <li key={application.public_id}>
                <Link to={manageUrl(application)} className="block px-4 py-3 !text-inherit transition hover:bg-slate-50">
                  <div className="flex items-start justify-between gap-3">
                    <Candidate application={application} />
                    <StatusPill status={application.status} />
                  </div>
                  <p className="job-cv-card__meta mt-2 flex min-w-0 items-center gap-1.5 text-xs text-slate-500">
                    <span className="truncate">{application.submitted_cv_title || application.cv_title || m.employer_job_cv_cv_fallback()}</span>
                    <span className="shrink-0 text-slate-300">·</span>
                    <span className="shrink-0">{formatRelativeDay(application.applied_at)}</span>
                  </p>
                  {application.ai_match_status && (
                    <p className="mt-2">
                      <Fit application={application} />
                    </p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
          {pageData.count > PAGE_SIZE && (
            <div className="flex justify-center border-t border-slate-100 px-4 py-3 sm:justify-end">
              <Pagination
                size="small"
                current={page}
                pageSize={PAGE_SIZE}
                total={pageData.count}
                showSizeChanger={false}
                onChange={(nextPage) => setPageState({ signature, page: nextPage })}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
