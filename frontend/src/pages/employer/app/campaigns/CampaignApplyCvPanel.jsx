import {
  EyeOutlined,
  ReloadOutlined,
  SearchOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Empty, Input, Select, Skeleton, Table, Tag, message } from 'antd'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  applicationKeys,
  getRecruiterApplications,
  RECRUITER_APPLICATION_STATUSES,
  RECRUITER_APPLICATION_STATUS_LABELS,
  updateApplicationStatus,
} from '@/entities/application'
import { getApiErrorMessage } from '@/shared/api/error-mapper'

const NEW_STATUSES = new Set(['submitted'])
const UNANSWERED_STATUSES = new Set(['submitted', 'viewed', 'considering'])

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

function csvCell(value) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`
}

function exportApplications(applications) {
  const rows = applications.map((application) => [
    application.candidate_name,
    application.candidate_email,
    application.job_title,
    application.submitted_cv_title || application.cv_title,
    RECRUITER_APPLICATION_STATUS_LABELS[application.status] || application.status,
    formatDate(application.applied_at || application.submitted_at),
  ])
  const content = [
    ['Ứng viên', 'Email', 'Tin tuyển dụng', 'CV đã nộp', 'Trạng thái', 'Ngày ứng tuyển'],
    ...rows,
  ].map((row) => row.map(csvCell).join(',')).join('\n')
  const blob = new Blob([`\uFEFF${content}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `danh-sach-cv-${new Date().toISOString().slice(0, 10)}.csv`
  anchor.click()
  URL.revokeObjectURL(url)
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
        <p className="mt-0.5 truncate text-xs text-slate-500">{application.candidate_email || '—'}</p>
      </div>
    </div>
  )
}

function StatusSelect({ application, onChange, updating }) {
  return (
    <Select
      aria-label={`Trạng thái ${application.candidate_name || application.candidate_email || 'ứng viên'}`}
      value={application.status}
      loading={updating}
      className="min-w-36"
      options={RECRUITER_APPLICATION_STATUSES.map(([value, label]) => ({ value, label }))}
      onChange={(nextStatus) => onChange(application.public_id, nextStatus)}
    />
  )
}

export default function CampaignApplyCvPanel({ publicId }) {
  const queryClient = useQueryClient()
  const [keyword, setKeyword] = useState('')
  const [label, setLabel] = useState('all')
  const [scope, setScope] = useState('all')
  const [status, setStatus] = useState('all')
  const [sort, setSort] = useState('default')
  const params = useMemo(() => ({ campaign: publicId }), [publicId])
  const applicationsQuery = useQuery({
    queryKey: applicationKeys.recruiterList(params),
    queryFn: () => getRecruiterApplications(params),
  })
  const statusMutation = useMutation({
    mutationFn: ({ applicationPublicId, nextStatus }) => (
      updateApplicationStatus(applicationPublicId, { status: nextStatus })
    ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: applicationKeys.recruiterList(params) })
      queryClient.invalidateQueries({ queryKey: ['campaigns'] })
      message.success('Đã cập nhật trạng thái hồ sơ.')
    },
    onError: (error) => message.error(getApiErrorMessage(error, 'Không thể cập nhật trạng thái hồ sơ.')),
  })

  const applications = useMemo(
    () => Array.isArray(applicationsQuery.data) ? applicationsQuery.data : [],
    [applicationsQuery.data],
  )
  const unreadCount = applications.filter((item) => NEW_STATUSES.has(item.status)).length
  const unansweredCount = applications.filter((item) => UNANSWERED_STATUSES.has(item.status)).length
  const visibleApplications = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLocaleLowerCase('vi-VN')
    const filtered = applications.filter((application) => {
      const matchesKeyword = !normalizedKeyword || [
        application.candidate_name,
        application.candidate_email,
        application.job_title,
        application.submitted_cv_title,
      ].some((value) => value?.toLocaleLowerCase('vi-VN').includes(normalizedKeyword))
      const matchesStatus = status === 'all' || application.status === status
      const matchesScope = scope === 'all'
        || (scope === 'unread' && NEW_STATUSES.has(application.status))
        || (scope === 'unanswered' && UNANSWERED_STATUSES.has(application.status))
      return matchesKeyword && matchesStatus && matchesScope
    })
    return [...filtered].sort((left, right) => {
      if (sort === 'newest' || sort === 'oldest') {
        const leftTime = new Date(left.applied_at || left.submitted_at || 0).getTime()
        const rightTime = new Date(right.applied_at || right.submitted_at || 0).getTime()
        return sort === 'newest' ? rightTime - leftTime : leftTime - rightTime
      }
      if (sort === 'name') {
        return (left.candidate_name || '').localeCompare(right.candidate_name || '', 'vi')
      }
      return 0
    })
  }, [applications, keyword, scope, sort, status])

  const resetFilters = () => {
    setKeyword('')
    setLabel('all')
    setScope('all')
    setStatus('all')
    setSort('default')
  }
  const updateStatus = (applicationPublicId, nextStatus) => {
    statusMutation.mutate({ applicationPublicId, nextStatus })
  }

  return (
    <div>
      <div className="border-b border-slate-200 px-4 py-4 lg:px-5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <span className="shrink-0 text-sm font-semibold text-slate-700">Bộ lọc:</span>
          <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(180px,1.35fr)_150px_190px_150px_190px]">
            <Input
              value={keyword}
              allowClear
              prefix={<SearchOutlined className="text-slate-400" />}
              placeholder="Tìm ứng viên..."
              onChange={(event) => setKeyword(event.target.value)}
            />
            <Select
              aria-label="Lọc theo nhãn"
              value={label}
              options={[{ value: 'all', label: 'Tất cả nhãn' }]}
              onChange={setLabel}
            />
            <Select
              aria-label="Lọc phạm vi CV"
              className="[&_.ant-select-selector]:!border-emerald-500"
              value={scope}
              options={[
                { value: 'all', label: 'Hiển thị tất cả CV' },
                { value: 'unread', label: 'CV chưa xem' },
                { value: 'unanswered', label: 'CV chưa phản hồi' },
              ]}
              onChange={setScope}
            />
            <Select
              aria-label="Lọc trạng thái"
              value={status}
              options={[
                { value: 'all', label: 'Trạng thái' },
                ...RECRUITER_APPLICATION_STATUSES.map(([value, text]) => ({ value, label: text })),
              ]}
              onChange={setStatus}
            />
            <Select
              aria-label="Sắp xếp CV"
              className="[&_.ant-select-selector]:!border-emerald-500"
              value={sort}
              options={[
                { value: 'default', label: 'Sắp xếp: Mặc định' },
                { value: 'newest', label: 'Mới nhất' },
                { value: 'oldest', label: 'Cũ nhất' },
                { value: 'name', label: 'Tên ứng viên' },
              ]}
              onChange={setSort}
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
          <span className="mr-1 font-semibold text-slate-700">Tìm thấy {visibleApplications.length} ứng viên</span>
          <button type="button" className="rounded-full bg-slate-100 px-3 py-1.5 text-slate-600" onClick={() => setScope('unread')}>CV chưa xem <strong>{unreadCount}</strong></button>
          <button type="button" className="rounded-full bg-slate-100 px-3 py-1.5 text-slate-600" onClick={() => setScope('unanswered')}>CV chưa phản hồi <strong>{unansweredCount}</strong></button>
        </div>
        <button
          type="button"
          disabled={!visibleApplications.length}
          className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded border border-emerald-600 bg-white px-4 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
          onClick={() => exportApplications(visibleApplications)}
        >
          <UploadOutlined /> Xuất danh sách CV
        </button>
      </div>

      {applicationsQuery.isLoading ? (
        <Skeleton active className="p-6" paragraph={{ rows: 6 }} />
      ) : (
        <div className="overflow-x-auto">
          <Table
            rowKey="public_id"
            dataSource={visibleApplications}
            pagination={{ pageSize: 10, hideOnSinglePage: true }}
            scroll={{ x: 1040 }}
            locale={{
              emptyText: (
                <Empty
                  className="py-16"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={<span className="text-slate-500">Chưa có CV ứng viên phù hợp</span>}
                />
              ),
            }}
            columns={[
              { title: 'Ứng viên', render: (_, application) => <CandidateCell application={application} /> },
              { title: 'Tin tuyển dụng', dataIndex: 'job_title', render: (value) => <span className="block min-w-44 text-slate-700">{value || '—'}</span> },
              { title: 'CV đã nộp', render: (_, application) => <span className="block min-w-36 text-slate-700">{application.submitted_cv_title || application.cv_title || 'CV ứng viên'}</span> },
              { title: 'Ngày ứng tuyển', render: (_, application) => <span className="whitespace-nowrap text-slate-600">{formatDate(application.applied_at || application.submitted_at)}</span> },
              {
                title: 'Trạng thái',
                render: (_, application) => (
                  <div className="min-w-36">
                    <Tag color={STATUS_COLORS[application.status]} className="mb-2">
                      {RECRUITER_APPLICATION_STATUS_LABELS[application.status] || application.status}
                    </Tag>
                    <StatusSelect
                      application={application}
                      onChange={updateStatus}
                      updating={statusMutation.isPending && statusMutation.variables?.applicationPublicId === application.public_id}
                    />
                  </div>
                ),
              },
              {
                title: '',
                align: 'right',
                render: (_, application) => (
                  <Link
                    to={`/tuyendung/app/applications?campaign=${publicId}&application=${application.public_id}`}
                    className="inline-flex items-center gap-1 whitespace-nowrap font-semibold !text-emerald-700 hover:!text-emerald-800"
                  >
                    <EyeOutlined /> Xử lý
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
