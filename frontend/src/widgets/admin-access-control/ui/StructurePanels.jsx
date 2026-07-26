import {
  EditOutlined,
  MoreOutlined,
  PlusOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons'
import { Button, Dropdown, Empty, Select, Space, Table, Tag, Tooltip, Typography } from 'antd'
import { useMemo, useState } from 'react'
import {
  QueryError,
  StatusBadge,
} from './AccessControlFeedback'
import AccessFilterBar from './AccessFilterBar'

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

function OverflowActions({ label, onImpact, restoreAction, isActive }) {
  const items = [
    ...(restoreAction ? [{
      key: 'restore',
      label: 'Khôi phục mặc định',
      onClick: restoreAction,
    }] : []),
    {
      key: 'status',
      label: isActive ? 'Khoá' : 'Mở lại',
      danger: isActive,
      onClick: onImpact,
    },
  ]

  return (
    <Dropdown menu={{ items }} trigger={['click']}>
      <Tooltip title="Thao tác khác">
        <Button
          type="text"
          className="min-h-11 min-w-11"
          icon={<MoreOutlined />}
          aria-label={`Thao tác khác cho ${label}`}
        />
      </Tooltip>
    </Dropdown>
  )
}

export function DepartmentPanel({
  departments,
  query,
  isSuperuser,
  onEdit,
  onImpact,
}) {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const filteredDepartments = useMemo(() => {
    const queryText = search.trim().toLocaleLowerCase('vi-VN')
    return departments.filter((item) => (
      (status === 'all' || String(item.is_active) === status)
      && (!queryText || [item.name, item.code, item.description]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('vi-VN')
        .includes(queryText))
    ))
  }, [departments, search, status])
  const columns = [
    {
      title: 'Phòng ban',
      dataIndex: 'name',
      render: (_, row) => (
        <div className="min-w-52">
          <Typography.Text strong className="text-slate-900">{row.name}</Typography.Text>
          <div className="mt-1 font-mono text-xs text-slate-400">{row.code}</div>
          {row.description && (
            <div className="mt-1 max-w-md text-sm text-slate-500">{row.description}</div>
          )}
        </div>
      ),
    },
    {
      title: 'Chức danh',
      dataIndex: 'role_count',
      width: 130,
      render: (value) => <span className="font-medium tabular-nums text-slate-700">{value}</span>,
    },
    {
      title: 'Nhân sự',
      width: 150,
      render: (_, row) => (
        <div className="text-sm">
          <div className="font-medium tabular-nums text-slate-700">{row.active_member_count} đang hiệu lực</div>
          {row.revoked_member_count > 0 && <div className="mt-1 text-slate-400">{row.revoked_member_count} đã thu hồi</div>}
        </div>
      ),
    },
    {
      title: 'Trạng thái',
      width: 140,
      render: (_, row) => <StatusBadge active={row.is_active} />,
    },
    ...(isSuperuser ? [{
      title: 'Thao tác',
      align: 'right',
      width: 150,
      render: (_, row) => (
        <Space size={4}>
          <IconAction label={`Sửa ${row.name}`} icon={<EditOutlined />} onClick={() => onEdit(row)} />
          <OverflowActions
            label={row.name}
            onImpact={() => onImpact({
              kind: 'departmentStatus',
              target: row,
              payload: { is_active: !row.is_active },
            })}
            isActive={row.is_active}
            restoreAction={row.is_restorable && !row.is_system_managed
              ? () => onImpact({ kind: 'departmentRestore', target: row })
              : undefined}
          />
        </Space>
      ),
    }] : []),
  ]

  if (query.isError) {
    return <QueryError message="Không thể tải danh sách phòng ban." onRetry={query.refetch} />
  }
  return (
    <>
      <AccessFilterBar
        search={search}
        onSearchChange={setSearch}
        searchLabel="Tìm phòng ban"
        searchPlaceholder="Tìm tên, mã hoặc mô tả"
        resultCount={filteredDepartments.length}
        activeFilters={Number(status !== 'all')}
        onClear={() => setStatus('all')}
        action={isSuperuser && (
          <Tooltip title="Thêm phòng ban">
            <Button type="primary" className="min-h-11 min-w-11" icon={<PlusOutlined />} aria-label="Thêm phòng ban" onClick={() => onEdit()} />
          </Tooltip>
        )}
      >
        <div>
          <Typography.Text strong>Trạng thái</Typography.Text>
          <Select
            className="mt-2 w-full"
            value={status}
            onChange={setStatus}
            aria-label="Lọc trạng thái phòng ban"
            options={[
              { value: 'all', label: 'Mọi trạng thái' },
              { value: 'true', label: 'Đang hoạt động' },
              { value: 'false', label: 'Đã khoá' },
            ]}
          />
        </div>
      </AccessFilterBar>
      <div className="overflow-x-auto">
        <Table
          rowKey="public_id"
          loading={query.isLoading}
          dataSource={filteredDepartments}
          columns={columns}
          pagination={false}
          locale={{ emptyText: <Empty description="Chưa có phòng ban" /> }}
          className="[&_.ant-table-tbody>tr>td]:py-4 [&_.ant-table-thead>tr>th]:bg-slate-50 [&_.ant-table-thead>tr>th]:text-xs [&_.ant-table-thead>tr>th]:font-semibold [&_.ant-table-thead>tr>th]:uppercase [&_.ant-table-thead>tr>th]:tracking-wide [&_.ant-table-thead>tr>th]:text-slate-500"
          scroll={{ x: isSuperuser ? 880 : 640 }}
        />
      </div>
    </>
  )
}

export function RolePanel({
  roles,
  departments,
  query,
  roleFilter,
  onRoleFilterChange,
  isSuperuser,
  onEdit,
  onEditPermissions,
  onImpact,
}) {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const filteredRoles = useMemo(() => {
    const queryText = search.trim().toLocaleLowerCase('vi-VN')
    return roles.filter((item) => (
      (status === 'all' || String(item.is_active) === status)
      && (!queryText || [item.name, item.code, item.description, item.department.name]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('vi-VN')
        .includes(queryText))
    ))
  }, [roles, search, status])
  const columns = [
    {
      title: 'Chức danh',
      dataIndex: 'name',
      render: (_, row) => (
        <div className="min-w-52">
          <Typography.Text strong className="text-slate-900">{row.name}</Typography.Text>
          <div className="mt-1 font-mono text-xs text-slate-400">{row.code}</div>
          {row.description && <div className="mt-1 max-w-sm text-sm text-slate-500">{row.description}</div>}
        </div>
      ),
    },
    {
      title: 'Phòng ban',
      width: 190,
      render: (_, row) => <Tag variant="filled" color="blue">{row.department.name}</Tag>,
    },
    {
      title: 'Quyền',
      width: 100,
      render: (_, row) => <span className="font-medium tabular-nums text-slate-700">{row.permission_codes.length}</span>,
    },
    {
      title: 'Nhân sự',
      width: 110,
      render: (_, row) => <span className="font-medium tabular-nums text-slate-700">{row.active_member_count}</span>,
    },
    {
      title: 'Trạng thái',
      width: 130,
      render: (_, row) => <StatusBadge active={row.is_active} />,
    },
    ...(isSuperuser ? [{
      title: 'Thao tác',
      align: 'right',
      width: 170,
      render: (_, row) => (
        <Space size={4}>
          <IconAction label={`Sửa ${row.name}`} icon={<EditOutlined />} onClick={() => onEdit(row)} />
          <IconAction label={`Quyền của ${row.name}`} icon={<SafetyCertificateOutlined />} onClick={() => onEditPermissions(row)} />
          <OverflowActions
            label={row.name}
            onImpact={() => onImpact({
              kind: 'roleStatus',
              target: row,
              payload: { is_active: !row.is_active },
            })}
            isActive={row.is_active}
            restoreAction={row.is_restorable && !row.is_system_managed
              ? () => onImpact({ kind: 'roleRestore', target: row })
              : undefined}
          />
        </Space>
      ),
    }] : []),
  ]

  if (query.isError) {
    return <QueryError message="Không thể tải danh sách chức danh." onRetry={query.refetch} />
  }
  return (
    <>

      <AccessFilterBar
        search={search}
        onSearchChange={setSearch}
        searchLabel="Tìm chức danh"
        searchPlaceholder="Tìm tên, mã hoặc mô tả"
        resultCount={filteredRoles.length}
        activeFilters={Number(Boolean(roleFilter)) + Number(status !== 'all')}
        onClear={() => {
          onRoleFilterChange('')
          setStatus('all')
        }}
        action={isSuperuser && (
          <Tooltip title="Thêm chức danh">
            <Button
              type="primary"
              className="min-h-11 min-w-11"
              icon={<PlusOutlined />}
              aria-label="Thêm chức danh"
              disabled={!departments.length}
              onClick={() => onEdit()}
            />
          </Tooltip>
        )}
      >
        <div>
          <Typography.Text strong>Phòng ban</Typography.Text>
          <Select
            className="mt-2 w-full"
            allowClear
            placeholder="Tất cả phòng ban"
            value={roleFilter || undefined}
            onChange={(value) => onRoleFilterChange(value || '')}
            options={departments.map((item) => ({ value: item.code, label: item.name }))}
          />
        </div>
        <div>
          <Typography.Text strong>Trạng thái</Typography.Text>
          <Select
            className="mt-2 w-full"
            value={status}
            onChange={setStatus}
            aria-label="Lọc trạng thái chức danh"
            options={[
              { value: 'all', label: 'Mọi trạng thái' },
              { value: 'true', label: 'Đang hoạt động' },
              { value: 'false', label: 'Đã khoá' },
            ]}
          />
        </div>
      </AccessFilterBar>
      <div className="overflow-x-auto">
        <Table
          rowKey="public_id"
          loading={query.isLoading}
          dataSource={filteredRoles}
          columns={columns}
          pagination={false}
          locale={{ emptyText: <Empty description="Chưa có chức danh phù hợp" /> }}
          className="[&_.ant-table-tbody>tr>td]:py-4 [&_.ant-table-thead>tr>th]:bg-slate-50 [&_.ant-table-thead>tr>th]:text-xs [&_.ant-table-thead>tr>th]:font-semibold [&_.ant-table-thead>tr>th]:uppercase [&_.ant-table-thead>tr>th]:tracking-wide [&_.ant-table-thead>tr>th]:text-slate-500"
          scroll={{ x: isSuperuser ? 980 : 730 }}
        />
      </div>
    </>
  )
}
