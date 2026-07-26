import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckOutlined, CloseOutlined, UndoOutlined } from '@ant-design/icons'
import {
  Alert,
  Button,
  Descriptions,
  Form,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
} from 'antd'
import { useState } from 'react'
import { useAdminAccess } from '@/entities/admin-access'
import { jobDetailPath } from '@/entities/job'
import {
  getAdminJobReports,
  jobReportKeys,
  JOB_REPORT_STATUS_COLORS,
  JOB_REPORT_STATUS_LABELS,
  JOB_REPORT_STATUS_OPTIONS,
  resolveAdminJobReport,
  reverseAdminJobReport,
} from '@/entities/job-report'
import { useSession } from '@/entities/session'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { message } from '@/shared/lib/toast'
import JobReportDecisionModal from './JobReportDecisionModal'

const PAGE_SIZE = 20

function formatDateTime(value) {
  return value ? new Date(value).toLocaleString('vi-VN') : '—'
}

export default function JobReportQueue() {
  const { user } = useSession()
  const adminAccess = useAdminAccess(user)
  const canResolve = adminAccess.has('job_moderation.resolve_report')
  const [statusFilter, setStatusFilter] = useState('pending')
  const [page, setPage] = useState(1)
  const [decision, setDecision] = useState(null)
  const [form] = Form.useForm()
  const queryClient = useQueryClient()
  const params = { status: statusFilter, page }
  const reportsQuery = useQuery({
    queryKey: jobReportKeys.adminList(params),
    queryFn: () => getAdminJobReports(params),
  })
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
      width: 260,
      render: (_, report) => (
        <div className="min-w-0">
          <a
            className="font-semibold text-slate-900 hover:text-[var(--brand-primary)]"
            href={jobDetailPath({ slug: report.job_slug, brand_slug: report.brand_slug })}
            rel="noreferrer"
            target="_blank"
          >
            {report.job_title}
          </a>
          <p className="mt-1 break-words text-xs text-slate-500">{report.company_name}</p>
        </div>
      ),
    },
    {
      title: 'Lý do',
      dataIndex: 'reason_label',
      width: 210,
      render: (value) => <span className="font-medium text-slate-800">{value}</span>,
    },
    {
      title: 'Mô tả',
      dataIndex: 'detail',
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
      width: 220,
      render: (value) => <span className="break-all text-sm">{value || 'Tài khoản đã xóa'}</span>,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
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
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-900">Báo cáo vi phạm</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Chỉ kết luận “vi phạm” đã được xác nhận mới ảnh hưởng huy hiệu của người đăng.
          </p>
        </div>
        <Select
          aria-label="Lọc trạng thái báo cáo"
          className="w-full sm:w-56"
          onChange={(value) => {
            setStatusFilter(value)
            setPage(1)
          }}
          options={[
            ...JOB_REPORT_STATUS_OPTIONS,
            { value: '', label: 'Tất cả trạng thái' },
          ]}
          value={statusFilter}
        />
      </div>
      {!canResolve && (
        <Alert
          showIcon
          title="Bạn có quyền xem nhưng không có quyền xử lý báo cáo."
          type="info"
        />
      )}
      {reportsQuery.isError && (
        <Alert
          action={<Button onClick={() => reportsQuery.refetch()} size="small">Thử lại</Button>}
          showIcon
          title="Không thể tải danh sách báo cáo."
          type="error"
        />
      )}
      <div className="overflow-x-auto">
        <Table
          columns={columns}
          dataSource={reportsQuery.data?.results || []}
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
          loading={reportsQuery.isLoading}
          locale={{ emptyText: 'Không có báo cáo phù hợp.' }}
          pagination={{
            current: page,
            onChange: setPage,
            pageSize: PAGE_SIZE,
            showSizeChanger: false,
            total: reportsQuery.data?.count || 0,
          }}
          rowKey="public_id"
          scroll={{ x: 1450 }}
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
    </div>
  )
}
