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
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import { useState } from 'react'
import {
  STAFF_DEFAULT_ORDERING,
  STAFF_DEFAULT_STATUS,
  STAFF_ORDERING_FIELDS,
} from '../model/access-control-view'
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

function sorterOrder(ordering, field) {
  if (ordering === field) return 'ascend'
  if (ordering === `-${field}`) return 'descend'
  return null
}

export default function MembershipPanel({
  data,
  query,
  departments,
  roles,
  filters,
  onFiltersChange,
  onAssign,
  onReplace,
  onImpact,
}) {
  const [selectedMember, setSelectedMember] = useState(null)
  const departmentOptions = departments.map((department) => ({
    value: department.public_id,
    label: department.name,
  }))
  const roleOptions = roles
    .filter((role) => !filters.department || role.department.public_id === filters.department)
    .map((role) => ({ value: role.public_id, label: role.name }))
  const columns = [
    {
      title: 'Nhân viên',
      key: 'user__full_name',
      sorter: true,
      sortOrder: sorterOrder(filters.ordering, 'user__full_name'),
      render: (_, row) => (
        <div>
          <Typography.Text strong>{row.user.full_name || row.user.email}</Typography.Text>
          {row.user.full_name && (
            <div><Typography.Text type="secondary">{row.user.email}</Typography.Text></div>
          )}
        </div>
      ),
    },
    {
      title: 'Phòng ban',
      key: 'role__department__name',
      sorter: true,
      sortOrder: sorterOrder(filters.ordering, 'role__department__name'),
      render: (_, row) => <Tag variant="filled" color="blue">{row.department.name}</Tag>,
    },
    {
      title: 'Chức danh',
      key: 'role__name',
      sorter: true,
      sortOrder: sorterOrder(filters.ordering, 'role__name'),
      render: (_, row) => (
        <div className="min-w-40">
          <Typography.Text strong className="text-slate-900">{row.role.name}</Typography.Text>
        </div>
      ),
    },
    {
      title: 'MFA',
      key: 'user__two_factor_enabled',
      width: 130,
      sorter: true,
      sortOrder: sorterOrder(filters.ordering, 'user__two_factor_enabled'),
      render: (_, row) => (
        <Tag color={row.user.two_factor_enabled ? 'green' : 'red'}>
          {row.user.two_factor_enabled ? 'Đã bật' : 'Chưa bật MFA'}
        </Tag>
      ),
    },
    {
      title: 'Trạng thái',
      key: 'is_active',
      width: 130,
      sorter: true,
      sortOrder: sorterOrder(filters.ordering, 'is_active'),
      render: (_, row) => <StatusBadge active={row.is_active} />,
    },
    {
      title: 'Cấp lúc',
      key: 'assigned_at',
      width: 170,
      sorter: true,
      sortOrder: sorterOrder(filters.ordering, 'assigned_at'),
      render: (_, row) => <span className="text-sm text-slate-500">{formatDateTime(row.assigned_at)}</span>,
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
        search={filters.q}
        onSearchChange={(q) => onFiltersChange({ q })}
        searchLabel="Tìm nhân viên hoặc chức danh"
        searchPlaceholder="Tìm nhân viên hoặc chức danh"
        resultCount={data.count}
        activeFilters={Number(Boolean(filters.department)) + Number(Boolean(filters.role)) + Number(filters.status !== STAFF_DEFAULT_STATUS)}
        onClear={() => onFiltersChange({
          q: '',
          department: '',
          role: '',
          status: STAFF_DEFAULT_STATUS,
          ordering: STAFF_DEFAULT_ORDERING,
        })}
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
            value={filters.department || undefined}
            onChange={(value) => {
              const department = value || ''
              const selectedRole = roles.find((role) => role.public_id === filters.role)
              onFiltersChange({
                department,
                role: department && selectedRole?.department.public_id !== department
                  ? ''
                  : filters.role,
              })
            }}
            options={departmentOptions}
            aria-label="Lọc nhân viên theo phòng ban"
          />
        </div>
        <div>
          <Typography.Text strong>Chức danh</Typography.Text>
          <Select
            allowClear
            className="mt-2 w-full"
            placeholder="Tất cả chức danh"
            value={filters.role || undefined}
            onChange={(value) => onFiltersChange({ role: value || '' })}
            options={roleOptions}
            aria-label="Lọc nhân viên theo chức danh"
          />
        </div>
        <div>
          <Typography.Text strong>Trạng thái</Typography.Text>
          <Select
            className="mt-2 w-full"
            value={filters.status}
            onChange={(status) => onFiltersChange({ status })}
            options={[
              { value: 'active', label: 'Đang hoạt động' },
              { value: 'revoked', label: 'Đã thu hồi' },
              { value: 'all', label: 'Tất cả trạng thái' },
            ]}
            aria-label="Lọc trạng thái chức danh nhân viên"
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
            dataSource={data.results}
            columns={columns}
            className="[&_.ant-table-tbody>tr>td]:py-4 [&_.ant-table-thead>tr>th]:bg-slate-50 [&_.ant-table-thead>tr>th]:text-xs [&_.ant-table-thead>tr>th]:font-semibold [&_.ant-table-thead>tr>th]:uppercase [&_.ant-table-thead>tr>th]:tracking-wide [&_.ant-table-thead>tr>th]:text-slate-500"
            locale={{
              emptyText: <Empty description="Chưa có nhân viên trong cơ cấu phân quyền" />,
            }}
            pagination={{
              current: filters.page,
              total: data.count,
              pageSize: 20,
              showSizeChanger: false,
            }}
            onChange={(pagination, _tableFilters, sorter, extra) => {
              if (extra.action === 'paginate') {
                onFiltersChange({ page: pagination.current || 1 })
                return
              }
              if (extra.action !== 'sort') return
              const selectedSorter = Array.isArray(sorter) ? sorter[0] : sorter
              const field = selectedSorter?.columnKey
              if (!STAFF_ORDERING_FIELDS.includes(field)) return
              const ordering = selectedSorter.order === 'ascend'
                ? field
                : selectedSorter.order === 'descend'
                  ? `-${field}`
                  : STAFF_DEFAULT_ORDERING
              onFiltersChange({ ordering })
            }}
            scroll={{ x: 1120 }}
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
