import { ArrowRightOutlined, DownloadOutlined, ExportOutlined, SearchOutlined } from '@ant-design/icons'
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query'
import { Alert, Button, Empty, Input, Pagination, Select, Skeleton, Table, Tooltip } from 'antd'
import dayjs from 'dayjs'
import { useState } from 'react'
import { Link } from 'react-router'
import {
  applicationKeys,
  exportRecruiterApplications,
  getRecruiterApplicationPage,
  RECRUITER_APPLICATION_STATUS_LABELS,
} from '@/entities/application'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { employerAppPath } from '@/shared/config/portals'
import useDebouncedValue from '@/shared/hooks/use-debounced-value'
import { message } from '@/shared/lib/toast'
import { MascotEmpty } from '@/shared/ui/mascot'
import {
  APPLICATION_STATUS_TONES,
  applicationFilterChips,
  applicationFilterParams,
  formatRelativeDay,
} from './job-detail-presentation'
import { candidateInitials, formatCount } from './job-list-presentation'

const PAGE_SIZE = 10
const ORDERING_OPTIONS = [
  { value: 'newest', label: 'Mới nhất' },
  { value: 'oldest', label: 'Cũ nhất' },
  { value: 'name', label: 'Tên ứng viên' },
]

function StatusPill({ status }) {
  return (
    <span className={`job-pill job-pill--status job-tone-${APPLICATION_STATUS_TONES[status] || 'slate'}`}>
      {RECRUITER_APPLICATION_STATUS_LABELS[status] || status}
    </span>
  )
}

function Candidate({ application }) {
  const name = application.candidate_name || application.candidate_email || 'Ứng viên'
  const isNew = application.status === 'submitted'
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
        {candidateInitials(name)}
        {isNew && <span aria-label="Hồ sơ mới" className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-orange-500" />}
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
  const [ordering, setOrdering] = useState('newest')
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
    onSuccess: ({ blob, filename }) => {
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = filename
      anchor.click()
      URL.revokeObjectURL(url)
    },
    onError: (error) => message.error(getApiErrorMessage(error, 'Không thể xuất danh sách CV.')),
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

  function resetFilters() {
    setKeywordInput('')
    onFilterChange('all')
  }

  if (!summary.total && !applicationsQuery.isLoading && !applications.length) {
    return (
      <MascotEmpty className="py-12" size={128} description="Chưa có ứng viên nộp hồ sơ cho tin này.">
        {publicUrl && (
          <Button href={publicUrl} target="_blank" rel="noopener noreferrer" icon={<ExportOutlined />}>
            Xem tin đăng
          </Button>
        )}
      </MascotEmpty>
    )
  }

  const columns = [
    { title: 'Ứng viên', key: 'candidate', render: (_, item) => <Candidate application={item} /> },
    {
      title: 'CV đã nộp',
      key: 'cv',
      render: (_, item) => (
        <span className="line-clamp-1 text-sm text-slate-700">{item.submitted_cv_title || item.cv_title || 'CV ứng viên'}</span>
      ),
    },
    { title: 'Trạng thái', key: 'status', width: 150, render: (_, item) => <StatusPill status={item.status} /> },
    { title: 'Ngày nộp', key: 'applied_at', width: 130, render: (_, item) => <AppliedAt value={item.applied_at || item.submitted_at} /> },
    {
      title: <span className="sr-only">Thao tác</span>,
      key: 'action',
      width: 120,
      align: 'right',
      render: (_, item) => (
        <Link to={manageUrl(item)} className="inline-flex items-center gap-1 whitespace-nowrap text-sm font-semibold !text-emerald-700 hover:!text-emerald-600">
          Xem hồ sơ <ArrowRightOutlined aria-hidden className="text-[10px]" />
        </Link>
      ),
    },
  ]

  return (
    <div className="min-w-0">
      <div className="job-cv-toolbar px-4 pt-4 sm:px-5">
        <Input
          allowClear
          aria-label="Tìm hồ sơ ứng tuyển"
          prefix={<SearchOutlined className="text-slate-400" aria-hidden />}
          placeholder="Tìm tên, email hoặc tên CV"
          value={keywordInput}
          onChange={(event) => setKeywordInput(event.target.value)}
        />
        <Select
          aria-label="Sắp xếp hồ sơ"
          className="min-w-0"
          value={ordering}
          options={ORDERING_OPTIONS}
          onChange={setOrdering}
        />
        <Tooltip title="Xuất danh sách CV (CSV)">
          <Button
            aria-label="Xuất danh sách CV"
            icon={<DownloadOutlined />}
            disabled={!pageData.count}
            loading={exportMutation.isPending}
            onClick={() => exportMutation.mutate()}
          />
        </Tooltip>
        <Link
          to={manageUrl()}
          className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 px-3 text-sm font-semibold !text-slate-700 transition hover:border-emerald-300 hover:!text-emerald-700"
        >
          Quản lý CV <ArrowRightOutlined aria-hidden className="text-[10px]" />
        </Link>
      </div>

      <div
        role="group"
        aria-label="Lọc hồ sơ theo trạng thái"
        className="job-strip gap-2 px-4 py-3 sm:flex-wrap sm:px-5"
      >
        {chips.map((chip) => {
          const active = chip.key === filter
          return (
            <button
              key={chip.key}
              type="button"
              aria-pressed={active}
              title={chip.key === 'submitted' ? 'Hồ sơ mới, chưa xem' : undefined}
              onClick={() => onFilterChange(chip.key)}
              className="job-chip"
            >
              {chip.tone && <span aria-hidden className={`job-dot job-tone-${chip.tone}`} />}
              {chip.label}
              <span>{formatCount(chip.count)}</span>
            </button>
          )
        })}
      </div>

      {applicationsQuery.isError ? (
        <div className="px-4 pb-4 sm:px-5">
          <Alert
            type="error"
            showIcon
            title={`Không thể tải hồ sơ ứng tuyển. ${getApiErrorMessage(applicationsQuery.error, 'Vui lòng thử lại sau.')}`}
            action={<Button size="small" danger onClick={() => applicationsQuery.refetch()}>Thử lại</Button>}
          />
        </div>
      ) : applicationsQuery.isLoading ? (
        <div className="px-4 pb-5 sm:px-5" aria-label="Đang tải hồ sơ ứng tuyển">
          <Skeleton active avatar paragraph={{ rows: 3 }} />
        </div>
      ) : applications.length === 0 ? (
        <div className="py-10">
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Không có hồ sơ phù hợp bộ lọc">
            <Button onClick={resetFilters}>Xóa bộ lọc</Button>
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
                    <span className="truncate">{application.submitted_cv_title || application.cv_title || 'CV ứng viên'}</span>
                    <span className="shrink-0 text-slate-300">·</span>
                    <span className="shrink-0">{formatRelativeDay(application.applied_at || application.submitted_at)}</span>
                  </p>
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
