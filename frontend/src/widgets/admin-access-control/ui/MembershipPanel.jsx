import { Button, Empty, Space, Switch, Table, Tag, Typography } from 'antd'
import { QueryError, StatusBadge } from './AccessControlFeedback'

export default function MembershipPanel({
  memberships,
  query,
  page,
  includeRevoked,
  onPageChange,
  onIncludeRevokedChange,
  onAssign,
  onImpact,
}) {
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
      title: 'Phòng ban / chức danh',
      render: (_, row) => (
        <div>
          <Typography.Text>{row.department.name}</Typography.Text>
          <div><Typography.Text type="secondary">{row.role.name}</Typography.Text></div>
        </div>
      ),
    },
    {
      title: 'Trạng thái',
      width: 150,
      render: (_, row) => (
        <Space orientation="vertical" size={4}>
          <StatusBadge active={row.is_active} />
          {row.is_primary && <Tag color="blue">Phòng ban chính</Tag>}
        </Space>
      ),
    },
    {
      title: 'Thao tác',
      width: 270,
      render: (_, row) => row.is_active ? (
        <Space wrap>
          {!row.is_primary && (
            <Button
              className="min-h-11"
              onClick={() => onImpact({ kind: 'primary', target: row })}
            >
              Đặt làm chính
            </Button>
          )}
          <Button
            className="min-h-11"
            danger
            onClick={() => onImpact({ kind: 'revoke', target: row })}
          >
            Thu hồi
          </Button>
        </Space>
      ) : <Typography.Text type="secondary">Đã thu hồi</Typography.Text>,
    },
  ]

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Switch
          checked={includeRevoked}
          onChange={onIncludeRevokedChange}
          checkedChildren="Hiện cả đã thu hồi"
          unCheckedChildren="Chỉ đang hoạt động"
          aria-label="Hiện cả membership đã thu hồi"
        />
        <Button
          type="primary"
          className="min-h-11 w-full sm:w-auto"
          onClick={onAssign}
        >
          Gán nhân viên
        </Button>
      </div>
      {query.isError ? (
        <QueryError message="Không thể tải danh sách nhân viên." onRetry={query.refetch} />
      ) : (
        <div className="overflow-x-auto">
          <Table
            rowKey="public_id"
            loading={query.isLoading}
            dataSource={memberships}
            columns={columns}
            locale={{
              emptyText: <Empty description="Chưa có nhân viên trong cơ cấu phân quyền" />,
            }}
            pagination={{
              current: page,
              total: query.data?.count || memberships.length,
              pageSize: 20,
              showSizeChanger: false,
              onChange: onPageChange,
            }}
            scroll={{ x: 980 }}
          />
        </div>
      )}
    </>
  )
}
