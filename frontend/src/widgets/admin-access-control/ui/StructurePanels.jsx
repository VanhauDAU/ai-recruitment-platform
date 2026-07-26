import { Button, Empty, Select, Space, Table, Typography } from 'antd'
import {
  ManagementBadge,
  QueryError,
  StatusBadge,
} from './AccessControlFeedback'

export function DepartmentPanel({
  departments,
  query,
  isSuperuser,
  onEdit,
  onImpact,
}) {
  const columns = [
    {
      title: 'Phòng ban',
      dataIndex: 'name',
      render: (_, row) => (
        <div>
          <Typography.Text strong>{row.name}</Typography.Text>
          <div><Typography.Text type="secondary" code>{row.code}</Typography.Text></div>
        </div>
      ),
    },
    {
      title: 'Trạng thái',
      width: 160,
      render: (_, row) => <StatusBadge active={row.is_active} />,
    },
    {
      title: 'Nguồn cấu hình',
      width: 190,
      render: (_, row) => <ManagementBadge managed={row.is_system_managed} />,
    },
    {
      title: 'Số liệu',
      width: 180,
      render: (_, row) => `${row.role_count} chức danh · ${row.active_member_count} nhân viên`,
    },
    ...(isSuperuser ? [{
      title: 'Thao tác',
      width: 330,
      render: (_, row) => (
        <Space wrap>
          <Button className="min-h-11" onClick={() => onEdit(row)}>Sửa</Button>
          <Button
            className="min-h-11"
            danger={row.is_active}
            onClick={() => onImpact({
              kind: 'departmentStatus',
              target: row,
              payload: { is_active: !row.is_active },
            })}
          >
            {row.is_active ? 'Khoá' : 'Mở lại'}
          </Button>
          {row.is_restorable && !row.is_system_managed && (
            <Button
              className="min-h-11"
              onClick={() => onImpact({ kind: 'departmentRestore', target: row })}
            >
              Khôi phục mặc định
            </Button>
          )}
        </Space>
      ),
    }] : []),
  ]

  if (query.isError) {
    return <QueryError message="Không thể tải danh sách phòng ban." onRetry={query.refetch} />
  }
  return (
    <>
      {isSuperuser && (
        <div className="mb-4 flex justify-end">
          <Button type="primary" className="min-h-11" onClick={() => onEdit()}>
            Thêm phòng ban
          </Button>
        </div>
      )}
      <div className="overflow-x-auto">
        <Table
          rowKey="public_id"
          loading={query.isLoading}
          dataSource={departments}
          columns={columns}
          pagination={false}
          locale={{ emptyText: <Empty description="Chưa có phòng ban" /> }}
          scroll={{ x: isSuperuser ? 1050 : 760 }}
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
  const columns = [
    {
      title: 'Chức danh',
      dataIndex: 'name',
      render: (_, row) => (
        <div>
          <Typography.Text strong>{row.name}</Typography.Text>
          <div>
            <Typography.Text type="secondary">
              {row.department.name} · {row.code}
            </Typography.Text>
          </div>
        </div>
      ),
    },
    { title: 'Rank', dataIndex: 'rank', width: 80 },
    {
      title: 'Trạng thái',
      width: 150,
      render: (_, row) => <StatusBadge active={row.is_active} />,
    },
    {
      title: 'Nguồn cấu hình',
      width: 190,
      render: (_, row) => <ManagementBadge managed={row.is_system_managed} />,
    },
    {
      title: 'Quyền / nhân viên',
      width: 170,
      render: (_, row) => `${row.permission_codes.length} quyền · ${row.active_member_count} nhân viên`,
    },
    ...(isSuperuser ? [{
      title: 'Thao tác',
      width: 410,
      render: (_, row) => (
        <Space wrap>
          <Button className="min-h-11" onClick={() => onEdit(row)}>Sửa</Button>
          <Button className="min-h-11" onClick={() => onEditPermissions(row)}>Sửa quyền</Button>
          <Button
            className="min-h-11"
            danger={row.is_active}
            onClick={() => onImpact({
              kind: 'roleStatus',
              target: row,
              payload: { is_active: !row.is_active },
            })}
          >
            {row.is_active ? 'Khoá' : 'Mở lại'}
          </Button>
          {row.is_restorable && !row.is_system_managed && (
            <Button
              className="min-h-11"
              onClick={() => onImpact({ kind: 'roleRestore', target: row })}
            >
              Khôi phục mặc định
            </Button>
          )}
        </Space>
      ),
    }] : []),
  ]

  if (query.isError) {
    return <QueryError message="Không thể tải danh sách chức danh." onRetry={query.refetch} />
  }
  return (
    <>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Select
          className="min-h-11 w-full sm:max-w-xs"
          allowClear
          placeholder="Lọc theo phòng ban"
          value={roleFilter || undefined}
          onChange={(value) => onRoleFilterChange(value || '')}
          options={departments.map((item) => ({ value: item.code, label: item.name }))}
        />
        {isSuperuser && (
          <Button
            type="primary"
            className="min-h-11 w-full sm:w-auto"
            disabled={!departments.length}
            onClick={() => onEdit()}
          >
            Thêm chức danh
          </Button>
        )}
      </div>
      <div className="overflow-x-auto">
        <Table
          rowKey="public_id"
          loading={query.isLoading}
          dataSource={roles}
          columns={columns}
          pagination={false}
          locale={{ emptyText: <Empty description="Chưa có chức danh phù hợp" /> }}
          scroll={{ x: isSuperuser ? 1250 : 800 }}
        />
      </div>
    </>
  )
}
