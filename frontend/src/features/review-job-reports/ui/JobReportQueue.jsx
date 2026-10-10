import { CheckOutlined, CloseOutlined, FilterOutlined, UndoOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Alert,
  Button,
  DatePicker,
  Descriptions,
  Empty,
  Form,
  Input,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
} from 'antd'
import dayjs from 'dayjs'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { useAdminAccess } from '@/entities/admin-access'
import { jobDetailPath } from '@/entities/job'
import {
  getAdminJobReports,
  jobReportKeys,
  JOB_REPORT_REASON_OPTIONS,
  JOB_REPORT_STATUS_COLORS,
  JOB_REPORT_STATUS_LABELS,
  JOB_REPORT_STATUS_OPTIONS,
  resolveAdminJobReport,
  reverseAdminJobReport,
} from '@/entities/job-report'
import { useSession } from '@/entities/session'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { message } from '@/shared/lib/toast'
import { AdminDataActions, AdminPanel } from '@/shared/ui/admin'
import JobReportDecisionModal from './JobReportDecisionModal'

const PAGE_SIZE = 20
const DEFAULT_STATUS = 'pending'
const DEFAULT_ORDERING = '-created_at'
const REPORT_QUERY_KEYS = [
  'report_status',
  'report_reason',
  'report_q',
  'report_created_from',
  'report_created_to',
  'report_ordering',
  'report_page',
]

function formatDateTime(value) {
  return value ? new Date(value).toLocaleString('vi-VN') : '—'
}

function sorterOrder(ordering, field) {
  if (ordering === field) return 'ascend'
  if (ordering === `-${field}`) return 'descend'
  return null
}

function positivePage(value) {
  const parsed = Number(value || 1)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1
}

export default function JobReportQueue() {
  const { user } = useSession()
  const adminAccess = useAdminAccess(user)
  const canResolve = adminAccess.has('job_moderation.resolve_report')
  const [searchParams, setSearchParams] = useSearchParams()
  const rawStatus = searchParams.get('report_status')
  const statusFilter = rawStatus === 'all' ? '' : rawStatus || DEFAULT_STATUS
  const reasonFilter = searchParams.get('report_reason') || ''
  const query = searchParams.get('report_q') || ''
  const createdFrom = searchParams.get('report_created_from') || ''
  const createdTo = searchParams.get('report_created_to') || ''
  const ordering = searchParams.get('report_ordering') || DEFAULT_ORDERING
  const page = positivePage(searchParams.get('report_page'))
  const [searchInput, setSearchInput] = useState(query)
  const [decision, setDecision] = useState(null)
  const [form] = Form.useForm()
  const queryClient = useQueryClient()
  const params = useMemo(() => ({
    ...(statusFilter && { status: statusFilter }),
    ...(reasonFilter && { reason: reasonFilter }),
    ...(query && { q: query }),
    ...(createdFrom && { created_from: createdFrom }),
    ...(createdTo && { created_to: createdTo }),
    ordering,
    page,
  }), [createdFrom, createdTo, ordering, page, query, reasonFilter, statusFilter])
  const reportsQuery = useQuery({
    queryKey: jobReportKeys.adminList(params),
    queryFn: ({ signal }) => getAdminJobReports(params, { signal }),
    placeholderData: (previousData) => previousData,
  })
  const reports = reportsQuery.data?.results || []
  const total = reportsQuery.data?.count || 0
  const activeFilterCount = [
    query,
    reasonFilter,
    createdFrom || createdTo,
    statusFilter !== DEFAULT_STATUS ? statusFilter || 'all' : '',
  ].filter(Boolean).length

  const patchParams = useCallback((changes, { resetPage = true, replace = false } = {}) => {
    const next = new URLSearchParams(searchParams)
    Object.entries(changes).forEach(([key, value]) => {
      const isDefault = (key === 'report_status' && value === DEFAULT_STATUS)
        || (key === 'report_ordering' && value === DEFAULT_ORDERING)
        || (key === 'report_page' && Number(value) === 1)
      if (value == null || value === '' || isDefault) next.delete(key)
      else next.set(key, String(value))
    })
    if (resetPage) next.delete('report_page')
    setSearchParams(next, { replace })
  }, [searchParams, setSearchParams])

  useEffect(() => setSearchInput(query), [query])

  useEffect(() => {
    const normalized = searchInput.trim()
    if (normalized === query) return undefined
    const timeoutId = window.setTimeout(() => {
      patchParams({ report_q: normalized }, { replace: true })
    }, 400)
    return () => window.clearTimeout(timeoutId)
  }, [patchParams, query, searchInput])

  const decisionMutation = useMutation({
    mutationFn: async ({ action, reportPublicId, note }) => {
      if (action === 'reverse') {
        return reverseAdminJobReport(reportPublicId, note)
      }
      return resolveAdminJobReport(reportPublicId, {
        status: action === 'uphold' ? 'upheld' : 'dismissed',
        note,
      })
    },
    onSuccess: (_, variables) => {
      const success = variables.action === 'uphold'
        ? 'Đã xác nhận báo cáo vi phạm.'
        : variables.action === 'dismiss'
          ? 'Đã bác báo cáo.'
          : 'Đã gỡ kết luận vi phạm.'
      message.success(success)
      form.resetFields()
      setDecision(null)
      queryClient.invalidateQueries({ queryKey: jobReportKeys.adminLists })
    },
    onError: (error) => {
      message.error(getApiErrorMessage(error, 'Không thể cập nhật báo cáo. Danh sách sẽ được tải lại.'))
      queryClient.invalidateQueries({ queryKey: jobReportKeys.adminLists })
    },
  })

  function clearFilters() {
    const next = new URLSearchParams(searchParams)
    REPORT_QUERY_KEYS.forEach((key) => next.delete(key))
    setSearchInput('')
    setSearchParams(next)
  }

  function openDecision(report, action) {
    form.resetFields()
    setDecision({ report, action })
  }

  async function submitDecision() {
    let values
    try {
      values = await form.validateFields()
    } catch {
      return
    }
    decisionMutation.mutate({
      action: decision.action,
      reportPublicId: decision.report.public_id,
      note: values.note?.trim() || '',
    })
  }

  const columns = [
    {
      title: 'Tin tuyển dụng',
      dataIndex: 'job_title',
      key: 'job_title',
      sorter: true,
      sortOrder: sorterOrder(ordering, 'job_title'),
      width: 260,
      render: (value, report) => (
        <div className="min-w-0">
          <a
            className="font-semibold text-slate-900 hover:text-[var(--brand-primary)]"
            href={jobDetailPath({ slug: report.job_slug, brand_slug: report.brand_slug })}
            rel="noreferrer"
            target="_blank"
          >
            {value}
          </a>
          <p className="mt-1 font-mono text-[11px] text-slate-400">{report.public_id}</p>
        </div>
      ),
    },
    {
      title: 'Công ty',
      dataIndex: 'company_name',
      key: 'company_name',
      sorter: true,
      sortOrder: sorterOrder(ordering, 'company_name'),
      width: 210,
      render: (value) => <span className="break-words font-medium text-slate-800">{value}</span>,
    },
    {
      title: 'Lý do',
      dataIndex: 'reason_label',
      key: 'reason',
      sorter: true,
      sortOrder: sorterOrder(ordering, 'reason'),
      width: 210,
      render: (value) => <span className="font-medium text-slate-800">{value}</span>,
    },
    {
      title: 'Mô tả',
      dataIndex: 'detail',
      key: 'detail',
      sorter: true,
      sortOrder: sorterOrder(ordering, 'detail'),
      width: 300,
      render: (value) => (
        <span className="line-clamp-3 whitespace-pre-wrap break-words text-sm text-slate-600">
          {value || 'Không có mô tả bổ sung'}
        </span>
      ),
    },
    {
      title: 'Người báo cáo',
      dataIndex: 'reporter_email',
      key: 'reporter_email',
      sorter: true,
      sortOrder: sorterOrder(ordering, 'reporter_email'),
      width: 220,
      render: (value) => <span className="break-all text-sm">{value || 'Tài khoản đã xóa'}</span>,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      sorter: true,
      sortOrder: sorterOrder(ordering, 'status'),
      width: 170,
      render: (value) => (
        <Tag color={JOB_REPORT_STATUS_COLORS[value]}>
          {JOB_REPORT_STATUS_LABELS[value] || value}
        </Tag>
      ),
    },
    {
      title: 'Thời điểm báo cáo',
      dataIndex: 'created_at',
      key: 'created_at',
      sorter: true,
      sortOrder: sorterOrder(ordering, 'created_at'),
      width: 180,
      render: formatDateTime,
    },
    {
      title: 'Thao tác',
      key: 'actions',
      fixed: 'right',
      width: 96,
      render: (_, report) => {
        if (!canResolve) return <span className="text-xs text-slate-500">Chỉ xem</span>
        if (report.status === 'pending') {
          return (
            <Space className="whitespace-nowrap" size={4}>
              <Tooltip title="Xác nhận vi phạm">
                <Button
                  aria-label="Xác nhận vi phạm"
                  danger
                  disabled={decisionMutation.isPending}
                  icon={<CheckOutlined />}
                  onClick={() => openDecision(report, 'uphold')}
                  size="small"
                  type="primary"
                />
              </Tooltip>
              <Tooltip title="Bác bỏ báo cáo">
                <Button
                  aria-label="Bác bỏ báo cáo"
                  disabled={decisionMutation.isPending}
                  icon={<CloseOutlined />}
                  onClick={() => openDecision(report, 'dismiss')}
                  size="small"
                />
              </Tooltip>
            </Space>
          )
        }
        if (report.status === 'upheld') {
          return (
            <Tooltip title="Gỡ kết luận">
              <Button
                aria-label="Gỡ kết luận"
                disabled={decisionMutation.isPending}
                icon={<UndoOutlined />}
                onClick={() => openDecision(report, 'reverse')}
                size="small"
              />
            </Tooltip>
          )
        }
        return '—'
      },
    },
  ]

  return (
    <AdminPanel
      title="Báo cáo vi phạm"
      description={`${total.toLocaleString('vi-VN')} báo cáo phù hợp. Chỉ kết luận vi phạm đã xác nhận mới ảnh hưởng huy hiệu người đăng.`}
      extra={(
        <AdminDataActions
          allowExport={false}
          onRefresh={() => reportsQuery.refetch()}
          refreshing={reportsQuery.isFetching}
        />
      )}
    >
      <div className="admin-list-toolbar" data-print-hide="true">
        <div className="admin-list-toolbar__filters">
          <Input.Search
            allowClear
            aria-label="Tìm báo cáo vi phạm"
            className="w-full sm:w-72"
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Mã, tin, công ty, email, nội dung"
            value={searchInput}
          />
          <Select
            aria-label="Lọc trạng thái báo cáo"
            className="w-full sm:w-52"
            onChange={(value) => patchParams({
              report_status: value === DEFAULT_STATUS ? null : value || 'all',
            })}
            options={[
              ...JOB_REPORT_STATUS_OPTIONS,
              { value: '', label: 'Tất cả trạng thái' },
            ]}
            value={statusFilter}
          />
          <Select
            allowClear
            aria-label="Lọc lý do báo cáo"
            className="w-full sm:w-60"
            onChange={(value) => patchParams({ report_reason: value })}
            options={JOB_REPORT_REASON_OPTIONS}
            placeholder="Tất cả lý do"
            value={reasonFilter || undefined}
          />
          <DatePicker.RangePicker
            aria-label="Lọc ngày báo cáo"
            className="w-full sm:w-auto"
            format="DD/MM/YYYY"
            onChange={(dates) => patchParams({
              report_created_from: dates?.[0]?.format('YYYY-MM-DD') || '',
              report_created_to: dates?.[1]?.format('YYYY-MM-DD') || '',
            })}
            value={createdFrom && createdTo ? [dayjs(createdFrom), dayjs(createdTo)] : null}
          />
        </div>
        {activeFilterCount > 0 && (
          <Button icon={<FilterOutlined />} onClick={clearFilters}>
            Xóa {activeFilterCount} bộ lọc
          </Button>
        )}
      </div>

      {!canResolve && (
        <Alert
          className="mb-4"
          showIcon
          title="Bạn có quyền xem nhưng không có quyền xử lý báo cáo."
          type="info"
        />
      )}
      {reportsQuery.isError && (
        <Alert
          action={<Button onClick={() => reportsQuery.refetch()} size="small">Thử lại</Button>}
          className="mb-4"
          description={getApiErrorMessage(reportsQuery.error)}
          showIcon
          title="Không thể tải danh sách báo cáo."
          type="error"
        />
      )}
      <div className="overflow-x-auto">
        <Table
          columns={columns}
          dataSource={reports}
          expandable={{
            expandedRowRender: (report) => (
              <Descriptions
                bordered
                column={{ xs: 1, sm: 2 }}
                size="small"
                items={[
                  {
                    key: 'resolution_note',
                    label: 'Ghi chú kết luận gần nhất',
                    children: report.resolution_note || '—',
                  },
                  {
                    key: 'resolved_by',
                    label: 'Người xử lý gần nhất',
                    children: report.resolved_by_email || '—',
                  },
                  {
                    key: 'resolved_at',
                    label: 'Thời điểm xử lý',
                    children: formatDateTime(report.resolved_at),
                  },
                  {
                    key: 'history',
                    label: 'Số lần quyết định',
                    children: report.resolution_history?.length || 0,
                  },
                ]}
              />
            ),
          }}
          loading={reportsQuery.isFetching}
          locale={{
            emptyText: (
              <Empty description={activeFilterCount
                ? 'Không có báo cáo phù hợp với bộ lọc.'
                : 'Chưa có báo cáo trong hàng đợi.'}
              />
            ),
          }}
          onChange={(pagination, _, sorter, extra) => {
            const selectedSorter = Array.isArray(sorter) ? sorter[0] : sorter
            const field = selectedSorter?.columnKey || selectedSorter?.field
            const nextOrdering = selectedSorter?.order
              ? `${selectedSorter.order === 'descend' ? '-' : ''}${field}`
              : DEFAULT_ORDERING
            const sortingChanged = extra?.action === 'sort' || nextOrdering !== ordering
            patchParams({
              report_ordering: nextOrdering,
              report_page: sortingChanged ? null : pagination.current,
            }, { resetPage: false })
          }}
          pagination={{
            current: page,
            pageSize: PAGE_SIZE,
            showSizeChanger: false,
            showTotal: (count, range) => `${range[0]}–${range[1]} / ${count} báo cáo`,
            total,
          }}
          rowKey="public_id"
          scroll={{ x: 1640 }}
          showSorterTooltip={{ target: 'sorter-icon' }}
        />
      </div>
      <JobReportDecisionModal
        decision={decision}
        form={form}
        onCancel={() => {
          if (decisionMutation.isPending) return
          form.resetFields()
          setDecision(null)
        }}
        onSubmit={submitDecision}
        pending={decisionMutation.isPending}
      />
    </AdminPanel>
  )
}
