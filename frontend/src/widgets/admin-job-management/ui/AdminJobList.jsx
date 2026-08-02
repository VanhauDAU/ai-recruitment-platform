import {
  ClockCircleOutlined,
  FileSearchOutlined,
  PauseCircleOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Alert, Button, Input, Select, Space, Table, Tag, Tooltip } from 'antd'
import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router'
import {
  adminJobKeys,
  adminJobStatusMeta,
  formatAdminJobDate,
  formatAdminJobDateTime,
  getAdminJobs,
  getAdminJobSummary,
  JOB_SCOPE_OPTIONS,
} from '@/entities/admin-job'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { adminPath } from '@/shared/config/portals'
import { AdminPanel, AdminStatCard } from '@/shared/ui/admin'

const EMPTY_PAGE = { count: 0, results: [] }
const DEFAULT_SCOPE = 'pending'
const DEFAULT_ORDERING = 'submitted_at'

function sorterOrder(ordering, field) {
  if (ordering === field) return 'ascend'
  if (ordering === `-${field}`) return 'descend'
  return null
}

function scopeToParams(scope) {
  if (scope === 'all') return {}
  if (scope === 'expired' || scope === 'held') return { scope }
  return { status: scope }
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
          label: 'Quản lý tin tuyển dụng',
        },
      },
    })
  }

  const columns = [
    {
      title: 'Tin tuyển dụng',
      dataIndex: 'title',
      key: 'title',
      sorter: true,
      sortOrder: sorterOrder(ordering, 'title'),
      width: 280,
      render: (title, job) => (
        <button className="text-left" onClick={() => openJob(job)} type="button">
          <span className="font-semibold text-slate-900 hover:text-[var(--brand-primary)]">
            {title}
          </span>
          <span className="mt-1 block font-mono text-xs text-slate-500">{job.public_id}</span>
        </button>
      ),
    },
    {
      title: 'Công ty',
      dataIndex: 'company_name',
      key: 'company',
      sorter: true,
      sortOrder: sorterOrder(ordering, 'company'),
      width: 220,
      render: (value, job) => (
        <div>
          <span className="font-medium text-slate-800">{value}</span>
          <span className="mt-1 block text-xs text-slate-500">
            {job.company_verification_status === 'verified' ? 'Đã xác thực pháp nhân' : 'Chưa xác thực pháp nhân'}
          </span>
        </div>
      ),
    },
    {
      title: 'Nhà tuyển dụng',
      dataIndex: 'employer_name',
      key: 'employer',
      sorter: true,
      sortOrder: sorterOrder(ordering, 'employer'),
      width: 230,
      render: (value, job) => (
        <div className="min-w-0">
          <span className="block truncate font-medium">{value}</span>
          <span className="block truncate text-xs text-slate-500">{job.employer_email}</span>
        </div>
      ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      sorter: true,
      sortOrder: sorterOrder(ordering, 'status'),
      width: 150,
      render: (_, job) => {
        const meta = adminJobStatusMeta(job)
        return (
          <Space orientation="vertical" size={3}>
            <Tag color={meta.color}>{job.status_label || meta.label}</Tag>
            {job.is_expired && <Tag color="orange">Quá hạn</Tag>}
            {(job.policy_hold || job.moderation_hold) && <Tag color="red">Tạm giữ</Tag>}
          </Space>
        )
      },
    },
    {
      title: 'Tín hiệu',
      dataIndex: 'pending_report_count',
      key: 'pending_reports',
      sorter: true,
      sortOrder: sorterOrder(ordering, 'pending_reports'),
      width: 155,
      render: (value, job) => (
        <Space orientation="vertical" size={2}>
          <span className={value ? 'font-semibold text-red-600' : 'text-slate-600'}>
            {value || 0} báo cáo chờ
          </span>
          <span className="text-xs text-slate-500">{job.approved_job_count || 0} tin từng duyệt</span>
        </Space>
      ),
    },
    {
      title: 'Hạn nộp',
      dataIndex: 'deadline',
      key: 'deadline',
      sorter: true,
      sortOrder: sorterOrder(ordering, 'deadline'),
      width: 130,
      render: formatAdminJobDate,
    },
    {
      title: 'Gửi duyệt',
      dataIndex: 'submitted_at',
      key: 'submitted_at',
      sorter: true,
      sortOrder: sorterOrder(ordering, 'submitted_at'),
      width: 175,
      render: formatAdminJobDateTime,
    },
    {
      title: 'Ứng tuyển',
      dataIndex: 'application_count',
      key: 'application_count',
      sorter: true,
      sortOrder: sorterOrder(ordering, 'application_count'),
      width: 110,
      align: 'right',
    },
    {
      title: 'Thao tác',
      key: 'actions',
      fixed: 'right',
      width: 100,
      render: (_, job) => (
        <Button size="small" type="link" onClick={() => openJob(job)}>Xem chi tiết</Button>
      ),
    },
  ]

  return (
    <div className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5" aria-label="Tổng quan tin tuyển dụng">
        <AdminStatCard
          active={scope === 'all'}
          icon={<FileSearchOutlined />}
          label="Tất cả tin"
          value={summary.total}
          detail="Toàn bộ vòng đời"
          onClick={() => chooseScope('all')}
        />
        <AdminStatCard
          active={scope === 'pending'}
          icon={<ClockCircleOutlined />}
          label="Chờ duyệt"
          value={summary.pending}
          detail={`${summary.overdue || 0} tin quá SLA ${summary.sla_hours || 24} giờ`}
          onClick={() => chooseScope('pending')}
          tone="amber"
        />
        <AdminStatCard
          active={scope === 'active'}
          icon={<SafetyCertificateOutlined />}
          label="Đang tuyển"
          value={summary.active}
          detail={`${summary.expired || 0} tin đã quá hạn`}
          onClick={() => chooseScope('active')}
          tone="green"
        />
        <AdminStatCard
          active={scope === 'held'}
          icon={<PauseCircleOutlined />}
          label="Đang tạm giữ"
          value={summary.held}
          detail="Policy hoặc kiểm duyệt"
          onClick={() => chooseScope('held')}
          tone="red"
        />
        <AdminStatCard
          active={scope === 'rejected'}
          icon={<FileSearchOutlined />}
          label="Đã từ chối"
          value={summary.rejected}
          detail={`${summary.pending_reports || 0} báo cáo đang chờ`}
          onClick={() => chooseScope('rejected')}
          tone="red"
        />
      </section>

      <AdminPanel
        title="Danh sách tin tuyển dụng"
        description="Mở chi tiết để xem toàn bộ nội dung, tín hiệu tin cậy và lịch sử trước khi quyết định."
        extra={(
          <Space wrap>
            <Input.Search
              allowClear
              aria-label="Tìm tin tuyển dụng"
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Tên tin, công ty, email, mã tin"
              value={searchInput}
              className="w-full sm:w-72"
            />
            <Select
              aria-label="Phạm vi tin tuyển dụng"
              className="w-full sm:w-44"
              onChange={chooseScope}
              options={JOB_SCOPE_OPTIONS}
              value={scope}
            />
          </Space>
        )}
      >
        {jobsQuery.isError && (
          <Alert
            action={<Button onClick={() => jobsQuery.refetch()}>Thử lại</Button>}
            className="mb-4"
            description={getApiErrorMessage(jobsQuery.error)}
            showIcon
            title="Không thể tải danh sách tin tuyển dụng"
            type="error"
          />
        )}
        <div className="overflow-x-auto">
          <Table
            columns={columns}
            dataSource={jobs.results || []}
            loading={jobsQuery.isLoading}
            locale={{ emptyText: 'Không có tin phù hợp.' }}
            onChange={(pagination, _, sorter) => {
              const field = sorter.columnKey || sorter.field
              const nextOrdering = sorter.order
                ? `${sorter.order === 'descend' ? '-' : ''}${field}`
                : DEFAULT_ORDERING
              patchParams({
                job_page: pagination.current,
                job_ordering: nextOrdering === DEFAULT_ORDERING ? null : nextOrdering,
              }, { resetPage: false })
            }}
            pagination={{
              current: page,
              pageSize: 20,
              showSizeChanger: false,
              total: jobs.count || 0,
            }}
            rowKey="public_id"
            scroll={{ x: 1580 }}
          />
        </div>
        {summaryQuery.isError && (
          <Tooltip title="Số liệu tổng quan chưa tải được; danh sách vẫn có thể sử dụng.">
            <span className="mt-3 inline-block text-xs text-amber-700">Không thể tải số liệu tổng quan.</span>
          </Tooltip>
        )}
      </AdminPanel>
    </div>
  )
}
