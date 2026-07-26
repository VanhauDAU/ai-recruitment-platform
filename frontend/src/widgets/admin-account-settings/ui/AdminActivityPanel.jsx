import { useQuery } from '@tanstack/react-query'
import { Alert, Card, Empty, Select, Switch, Table, Tag } from 'antd'
import { useState } from 'react'
import {
  adminAccessKeys,
  auditActionLabel,
  auditSourceLabel,
  AUDIT_ACTION_LABELS,
  getAdminAuditLogs,
  useAdminAccess,
} from '@/entities/admin-access'
import { useSession } from '@/entities/session'
import { groupSessions, listSessionHistory } from '@/features/session-management'

const PAGE_SIZE = 10

function formatDateTime(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

const ACTION_OPTIONS = [
  { value: '', label: 'Tất cả thao tác' },
  ...Object.keys(AUDIT_ACTION_LABELS).map((code) => ({ value: code, label: auditActionLabel(code) })),
]

export default function AdminActivityPanel() {
  const { user } = useSession()
  const adminAccess = useAdminAccess(user)
  const canViewAll = adminAccess.has('audit_log.view')
  const [scopeAll, setScopeAll] = useState(false)
  const [action, setAction] = useState('')
  const [page, setPage] = useState(1)

  const scope = scopeAll && canViewAll ? 'all' : 'mine'
  const params = { scope, action, page }
  const { data, isLoading, isError } = useQuery({
    queryKey: adminAccessKeys.auditLogs(params),
    queryFn: ({ signal }) => getAdminAuditLogs({ ...params, signal }),
    placeholderData: (previous) => previous,
  })
  const history = useQuery({
    queryKey: ['auth-sessions', 'history'],
    queryFn: listSessionHistory,
  })

  const columns = [
    {
      title: 'Thời điểm',
      dataIndex: 'created_at',
      width: 170,
      render: formatDateTime,
    },
    {
      title: 'Thao tác',
      dataIndex: 'action',
      render: (value) => <span className="font-medium text-slate-800">{auditActionLabel(value)}</span>,
    },
    {
      title: 'Nguồn',
      dataIndex: 'source',
      width: 160,
      render: (value) => <Tag>{auditSourceLabel(value)}</Tag>,
    },
    ...(scope === 'all'
      ? [{
        title: 'Người thực hiện',
        dataIndex: 'actor_email',
        render: (value, row) => value || row.actor_identifier || '—',
      }]
      : []),
  ]

  return (
    <div className="space-y-5">
      <Card
        title="Nhật ký thao tác"
        extra={canViewAll && (
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <Switch
              size="small"
              checked={scopeAll}
              onChange={(checked) => { setScopeAll(checked); setPage(1) }}
              aria-label="Xem nhật ký toàn hệ thống"
            />
            Toàn hệ thống
          </label>
        )}
      >
        <div className="mb-4 max-w-xs">
          <Select
            className="w-full"
            aria-label="Lọc theo thao tác"
            value={action}
            options={ACTION_OPTIONS}
            onChange={(value) => { setAction(value); setPage(1) }}
          />
        </div>
        {isError ? (
          <Alert showIcon type="error" message="Không tải được nhật ký hoạt động." />
        ) : (
          <div className="overflow-x-auto">
            <Table
              rowKey="public_id"
              size="middle"
              loading={isLoading}
              columns={columns}
              dataSource={data?.results || []}
              pagination={{
                current: page,
                pageSize: PAGE_SIZE,
                total: data?.count || 0,
                showSizeChanger: false,
                onChange: setPage,
              }}
              locale={{ emptyText: <Empty description="Chưa có thao tác nào được ghi nhận." /> }}
            />
          </div>
        )}
      </Card>

      <Card title="Lịch sử đăng nhập">
        <p className="mb-4 text-sm text-slate-500">
          Mỗi thiết bị/IP chỉ hiển thị một lần. Nếu thấy thiết bị lạ, hãy đổi mật khẩu ngay.
        </p>
        <div className="overflow-x-auto">
          <Table
            rowKey="id"
            size="middle"
            loading={history.isLoading}
            pagination={false}
            dataSource={groupSessions(history.data || [])}
            locale={{ emptyText: <Empty description="Chưa có phiên đăng nhập nào." /> }}
            columns={[
              { title: 'Thiết bị', dataIndex: 'device_label', render: (value) => value || 'Không xác định' },
              { title: 'IP', dataIndex: 'ip_address', width: 150, render: (value) => value || '—' },
              { title: 'Hoạt động gần nhất', dataIndex: 'last_seen_at', width: 170, render: formatDateTime },
              {
                title: 'Trạng thái',
                dataIndex: 'revoked_at',
                width: 150,
                render: (revokedAt, row) => (
                  row.current
                    ? <Tag color="green">Thiết bị này</Tag>
                    : revokedAt
                      ? <Tag>Đã đăng xuất</Tag>
                      : <Tag color="blue">Đang hoạt động</Tag>
                ),
              },
            ]}
          />
        </div>
      </Card>
    </div>
  )
}
