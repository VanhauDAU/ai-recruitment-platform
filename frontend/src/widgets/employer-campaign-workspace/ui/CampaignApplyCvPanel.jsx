import {
  DownloadOutlined,
  EyeOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Alert, Empty, Input, Select, Skeleton, Table, Tag, message } from 'antd'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  applicationKeys,
  exportRecruiterApplications,
  getRecruiterApplicationPage,
  RECRUITER_APPLICATION_STATUSES,
  RECRUITER_APPLICATION_STATUS_LABELS,
} from '@/entities/application'
import { campaignKeys, getCampaignReport } from '@/entities/campaign'
import { getEmployerJobs, jobKeys } from '@/entities/job'
import { getApiErrorMessage } from '@/shared/api/error-mapper'

const STATUS_COLORS = {
  submitted: 'blue',
  viewed: 'cyan',
  considering: 'gold',
  shortlisted: 'green',
  interviewed: 'purple',
  accepted: 'success',
  rejected: 'default',
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function CandidateCell({ application }) {
  const displayName = application.candidate_name || application.candidate_email || 'Ứng viên'
  return (
    <div className="flex min-w-52 items-center gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 font-bold text-emerald-700">
        {displayName.trim().charAt(0).toLocaleUpperCase('vi-VN')}
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
      getApiErrorMessage(error, 'Không thể xuất danh sách CV.'),
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
      <div className="border-b border-slate-200 px-4 py-4 lg:px-5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <span className="shrink-0 text-sm font-semibold text-slate-700">Bộ lọc:</span>
          <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(180px,1.35fr)_180px_190px_160px_180px]">
            <Input
              value={keywordInput}
              allowClear
              prefix={<SearchOutlined className="text-slate-400" />}
              placeholder="Tìm ứng viên, CV hoặc tin..."
              onChange={(event) => setKeywordInput(event.target.value)}
              onClear={() => updateFilter(setKeyword)('')}
              onPressEnter={() => updateFilter(setKeyword)(keywordInput.trim())}
            />
            <Select
              aria-label="Lọc theo tin tuyển dụng"
              value={job}
              options={[
                { value: '', label: 'Tất cả tin tuyển dụng' },
                ...(jobsQuery.data || []).map((item) => ({
                  value: item.public_id,
                  label: item.title || 'Tin chưa đặt tên',
                })),
              ]}
              onChange={updateFilter(setJob)}
            />
            <Select
              aria-label="Lọc phạm vi CV"
              value={scope}
              options={[
                { value: '', label: 'Hiển thị tất cả hồ sơ' },
                { value: 'unread', label: 'Hồ sơ chưa xem' },
                { value: 'unanswered', label: 'Hồ sơ chưa phản hồi' },
              ]}
              onChange={updateFilter(setScope)}
            />
            <Select
              aria-label="Lọc trạng thái"
              value={status}
              options={[
                { value: '', label: 'Tất cả trạng thái' },
                ...RECRUITER_APPLICATION_STATUSES.map(([value, text]) => ({
                  value,
                  label: text,
                })),
              ]}
              onChange={updateFilter(setStatus)}
            />
            <Select
              aria-label="Sắp xếp CV"
              value={ordering}
              options={[
                { value: 'newest', label: 'Mới nhất' },
                { value: 'oldest', label: 'Cũ nhất' },
                { value: 'name', label: 'Tên ứng viên' },
              ]}
              onChange={updateFilter(setOrdering)}
            />
          </div>
          <button
            type="button"
            className="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 px-2 text-sm font-medium text-slate-500 hover:text-emerald-700"
            onClick={resetFilters}
          >
            <ReloadOutlined /> Đặt lại
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between lg:px-5">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="mr-1 font-semibold text-slate-700">
            Tìm thấy {pageData.count || 0} hồ sơ ứng tuyển
          </span>
          <button
            type="button"
            className="rounded-full bg-slate-100 px-3 py-1.5 text-slate-600"
            onClick={() => updateFilter(setScope)('unread')}
          >
            Hồ sơ chưa xem <strong>{report.unviewed_count || 0}</strong>
          </button>
          <button
            type="button"
            className="rounded-full bg-slate-100 px-3 py-1.5 text-slate-600"
            onClick={() => updateFilter(setScope)('unanswered')}
          >
            Hồ sơ chưa phản hồi <strong>{report.unanswered_count || 0}</strong>
          </button>
        </div>
        <button
          type="button"
          disabled={!pageData.count || exportMutation.isPending}
          className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded border border-emerald-600 bg-white px-4 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
          onClick={() => exportMutation.mutate()}
        >
          <DownloadOutlined /> Xuất danh sách CV
        </button>
      </div>

      {applicationsQuery.isError ? (
        <Alert
          className="m-4"
          type="error"
          showIcon
          message="Không thể tải CV ứng tuyển"
          description={getApiErrorMessage(applicationsQuery.error, 'Vui lòng thử lại sau.')}
          action={(
            <button
              type="button"
              className="font-semibold text-red-700"
              onClick={() => applicationsQuery.refetch()}
            >
              Thử lại
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
                  description={<span className="text-slate-500">Chưa có CV phù hợp</span>}
                />
              ),
            }}
            columns={[
              {
                title: 'Ứng viên',
                render: (_, application) => <CandidateCell application={application} />,
              },
              {
                title: 'Tin tuyển dụng',
                dataIndex: 'job_title',
                render: (value) => (
                  <span className="block min-w-44 text-slate-700">{value || '—'}</span>
                ),
              },
              {
                title: 'CV đã nộp',
                render: (_, application) => (
                  <span className="block min-w-36 text-slate-700">
                    {application.submitted_cv_title || application.cv_title || 'CV ứng viên'}
                  </span>
                ),
              },
              {
                title: 'Ngày ứng tuyển',
                render: (_, application) => (
                  <span className="whitespace-nowrap text-slate-600">
                    {formatDate(application.applied_at || application.submitted_at)}
                  </span>
                ),
              },
              {
                title: 'Trạng thái',
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
                    to={`/tuyendung/app/applications?campaign=${publicId}&application=${application.public_id}`}
                    className="inline-flex items-center gap-1 whitespace-nowrap font-semibold !text-emerald-700"
                  >
                    <EyeOutlined /> Chi tiết
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
