import {
  EyeOutlined,
  PlusOutlined,
  StopOutlined,
  SwapOutlined,
} from '@ant-design/icons'
import {
  Button,
  Descriptions,
  Drawer,
  Empty,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import { useMemo, useState } from 'react'
import { QueryError, StatusBadge } from './AccessControlFeedback'
import AccessFilterBar from './AccessFilterBar'

const dateTimeFormatter = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

function formatDateTime(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : dateTimeFormatter.format(date)
}

function IconAction({ label, icon, onClick, danger = false }) {
  return (
    <Tooltip title={label}>
      <Button
        type="text"
        danger={danger}
        className="min-h-11 min-w-11"
        icon={icon}
        aria-label={label}
        onClick={onClick}
      />
    </Tooltip>
  )
}

export default function MembershipPanel({
  memberships,
  query,
  page,
  includeRevoked,
  onPageChange,
  onIncludeRevokedChange,
  onAssign,
  onReplace,
  onImpact,
}) {
  const [search, setSearch] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState('')
  const [mfaFilter, setMfaFilter] = useState('all')
  const [selectedMember, setSelectedMember] = useState(null)
  const filteredMemberships = useMemo(() => {
    const queryText = search.trim().toLocaleLowerCase('vi-VN')
    return memberships.filter((item) => (
      (!departmentFilter || item.department.public_id === departmentFilter)
      && (mfaFilter === 'all' || String(item.user.two_factor_enabled) === mfaFilter)
      && (!queryText || [
        item.user.full_name,
        item.user.email,
        item.role.name,
        item.department.name,
      ].filter(Boolean).join(' ').toLocaleLowerCase('vi-VN').includes(queryText))
    ))
  }, [departmentFilter, memberships, mfaFilter, search])
  const departmentOptions = useMemo(() => {
    const values = new Map()
    memberships.forEach((item) => values.set(item.department.public_id, item.department.name))
    return [...values].map(([value, label]) => ({ value, label }))
  }, [memberships])
  const columns = [
    {
      title: 'Nhân viên',
      render: (_, row) => (
        <div>
          <Typography.Text strong>{row.user.full_name || row.user.email}</Typography.Text>
          {row.user.full_name && (
            <div><Typography.Text type="secondary">{row.user.email}</Typography.Text></div>
          )}
          {!row.user.two_factor_enabled && (
            <div className="mt-1"><Tag color="red">Chưa bật MFA</Tag></div>
          )}
        </div>
      ),
    },
    {
      title: 'Chức danh',
      render: (_, row) => (
        <div className="min-w-52">
          <Typography.Text strong className="text-slate-900">{row.role.name}</Typography.Text>
          <div className="mt-1"><Tag variant="filled" color="blue">{row.department.name}</Tag></div>
        </div>
      ),
    },
    {
      title: 'Cấp quyền',
      width: 180,
      render: (_, row) => (
        <div className="text-sm">
          <StatusBadge active={row.is_active} />
          <div className="mt-2 text-slate-500">{formatDateTime(row.assigned_at)}</div>
        </div>
      ),
    },
    {
      title: 'Thao tác',
      align: 'right',
      width: 172,
      render: (_, row) => row.is_active ? (
        <Space size={4}>
          <IconAction label={`Xem chi tiết ${row.user.full_name || row.user.email}`} icon={<EyeOutlined />} onClick={() => setSelectedMember(row)} />
          <IconAction label={`Đổi chức danh của ${row.user.full_name || row.user.email}`} icon={<SwapOutlined />} onClick={() => onReplace(row)} />
          <IconAction
            label={`Thu hồi chức danh của ${row.user.full_name || row.user.email}`}
            icon={<StopOutlined />}
            danger
            onClick={() => onImpact({ kind: 'revoke', target: row })}
          />
        </Space>
      ) : (
        <IconAction label={`Xem chi tiết ${row.user.full_name || row.user.email}`} icon={<EyeOutlined />} onClick={() => setSelectedMember(row)} />
      ),
    },
  ]

  return (
    <>
      <AccessFilterBar
        search={search}
        onSearchChange={(value) => {
          setSearch(value)
          onPageChange(1)
        }}
        searchLabel="Tìm nhân viên hoặc chức danh"
        searchPlaceholder="Tìm nhân viên hoặc chức danh"
        resultCount={filteredMemberships.length}
        activeFilters={Number(Boolean(departmentFilter)) + Number(mfaFilter !== 'all') + Number(includeRevoked)}
        onClear={() => {
          setDepartmentFilter('')
          setMfaFilter('all')
          onIncludeRevokedChange(false)
          onPageChange(1)
        }}
        action={(
          <Tooltip title="Gán chức danh">
            <Button type="primary" className="min-h-11 min-w-11" icon={<PlusOutlined />} aria-label="Gán chức danh" onClick={onAssign} />
          </Tooltip>
        )}
      >
        <div>
          <Typography.Text strong>Phòng ban</Typography.Text>
          <Select
            allowClear
            className="mt-2 w-full"
            placeholder="Tất cả phòng ban"
            value={departmentFilter || undefined}
            onChange={(value) => {
              setDepartmentFilter(value || '')
              onPageChange(1)
            }}
            options={departmentOptions}
            aria-label="Lọc nhân viên theo phòng ban"
          />
        </div>
        <div>
          <Typography.Text strong>MFA</Typography.Text>
          <Select
            className="mt-2 w-full"
            value={mfaFilter}
            onChange={(value) => {
              setMfaFilter(value)
              onPageChange(1)
            }}
            options={[
              { value: 'all', label: 'Mọi trạng thái MFA' },
              { value: 'true', label: 'Đã bật MFA' },
              { value: 'false', label: 'Chưa bật MFA' },
            ]}
            aria-label="Lọc trạng thái MFA"
          />
        </div>
        <div className="flex items-center justify-between gap-4 rounded-lg bg-slate-50 px-3 py-2">
          <div>
            <Typography.Text strong>Lịch sử thu hồi</Typography.Text>
            <div className="text-xs text-slate-500">Hiển thị cả chức danh đã thu hồi.</div>
          </div>
          <Switch
            checked={includeRevoked}
            onChange={onIncludeRevokedChange}
            aria-label="Hiện cả membership đã thu hồi"
          />
        </div>
      </AccessFilterBar>
      {query.isError ? (
        <QueryError message="Không thể tải danh sách nhân viên." onRetry={query.refetch} />
      ) : (
        <div className="overflow-x-auto">
          <Table
            rowKey="public_id"
            loading={query.isLoading}
            dataSource={filteredMemberships}
            columns={columns}
            className="[&_.ant-table-tbody>tr>td]:py-4 [&_.ant-table-thead>tr>th]:bg-slate-50 [&_.ant-table-thead>tr>th]:text-xs [&_.ant-table-thead>tr>th]:font-semibold [&_.ant-table-thead>tr>th]:uppercase [&_.ant-table-thead>tr>th]:tracking-wide [&_.ant-table-thead>tr>th]:text-slate-500"
            locale={{
              emptyText: <Empty description="Chưa có nhân viên trong cơ cấu phân quyền" />,
            }}
            pagination={{
              current: page,
              total: filteredMemberships.length,
              pageSize: 20,
              showSizeChanger: false,
              onChange: onPageChange,
            }}
            scroll={{ x: 900 }}
          />
        </div>
      )}
      <Drawer
        title="Chi tiết nhân viên"
        open={Boolean(selectedMember)}
        onClose={() => setSelectedMember(null)}
        size={480}
      >
        {selectedMember && (
          <div className="space-y-5">
            <div>
              <Typography.Title level={5} className="!mb-1">
                {selectedMember.user.full_name || selectedMember.user.email}
              </Typography.Title>
              <Typography.Text type="secondary">{selectedMember.user.email}</Typography.Text>
            </div>
            <Descriptions bordered size="small" column={1}>
              <Descriptions.Item label="Chức danh">{selectedMember.role.name}</Descriptions.Item>
              <Descriptions.Item label="Phòng ban">{selectedMember.department.name}</Descriptions.Item>
              <Descriptions.Item label="Trạng thái"><StatusBadge active={selectedMember.is_active} /></Descriptions.Item>
              <Descriptions.Item label="MFA">
                <Tag color={selectedMember.user.two_factor_enabled ? 'green' : 'red'}>
                  {selectedMember.user.two_factor_enabled ? 'Đã bật' : 'Chưa bật'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Được cấp lúc">{formatDateTime(selectedMember.assigned_at)}</Descriptions.Item>
              <Descriptions.Item label="Người cấp">{selectedMember.assigned_by_email || 'Hệ thống / không lưu'}</Descriptions.Item>
              {!selectedMember.is_active && <Descriptions.Item label="Thu hồi lúc">{formatDateTime(selectedMember.revoked_at)}</Descriptions.Item>}
              <Descriptions.Item label="Mã bản ghi"><Typography.Text copyable code>{selectedMember.public_id}</Typography.Text></Descriptions.Item>
            </Descriptions>
          </div>
        )}
      </Drawer>
    </>
  )
}
