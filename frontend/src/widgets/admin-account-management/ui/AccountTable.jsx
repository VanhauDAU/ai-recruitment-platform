import {
  EditOutlined,
  EyeOutlined,
  MoreOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons'
import { Avatar, Button, Dropdown, Space, Table, Tag, Tooltip, Typography } from 'antd'
import {
  accountSubtitle,
  formatAdminDate,
} from '@/entities/admin-account'
import { AccountRoleTag, AccountStatusTag } from './AccountStatusTag'

function initials(value) {
  return (value || '?')
    .split(/\s+/)
    .slice(-2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

export default function AccountTable({
  data,
  loading,
  page,
  onPageChange,
  onQuickView,
  onOpenDetail,
  onEdit,
  canEdit,
  canManageSecurity,
  onSecurity,
}) {
  const columns = [
    {
      title: 'Tài khoản',
      key: 'identity',
      width: 290,
      render: (_, row) => (
        <button
          type="button"
          className="account-identity"
          onClick={() => onQuickView(row)}
        >
          <Avatar src={row.avatar_url || undefined}>{initials(row.full_name || row.email)}</Avatar>
          <span className="min-w-0 text-left">
            <Typography.Text strong ellipsis className="!block">
              {row.full_name || 'Chưa cập nhật họ tên'}
            </Typography.Text>
            <Typography.Text type="secondary" ellipsis className="!block !text-xs">
              {row.email}
            </Typography.Text>
          </span>
        </button>
      ),
    },
    {
      title: 'Loại & ngữ cảnh',
      key: 'role',
      width: 235,
      render: (_, row) => (
        <div className="space-y-1.5">
          <AccountRoleTag role={row.role} />
          <Typography.Text type="secondary" ellipsis className="!block !text-xs">
            {accountSubtitle(row)}
          </Typography.Text>
        </div>
      ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      width: 150,
      render: (status) => <AccountStatusTag status={status} />,
    },
    {
      title: 'Xác thực NTD',
      key: 'verification',
      width: 190,
      render: (_, row) => {
        if (row.role !== 'employer') return <Typography.Text type="secondary">Không áp dụng</Typography.Text>
        const verification = row.context?.verification
        const colors = {
          approved: 'green',
          rejected: 'red',
          changes_requested: 'orange',
          in_review: 'blue',
          pending: 'gold',
        }
        return (
          <div className="account-security-stack">
            <Tag color={colors[verification?.status] || 'default'}>
              {verification?.status_label || 'Chưa nộp'}
            </Tag>
            <span className="text-slate-500">
              {`${verification?.missing_step_count ?? 10} bước còn thiếu`}
            </span>
          </div>
        )
      },
    },
    {
      title: 'Bảo mật',
      key: 'security',
      width: 190,
      render: (_, row) => (
        <div className="account-security-stack">
          <span className={row.email_verified ? 'is-positive' : 'is-warning'}>
            {row.email_verified ? 'Email đã xác minh' : 'Email chưa xác minh'}
          </span>
          <span className={row.two_factor_enabled ? 'is-positive' : 'text-slate-500'}>
            {row.two_factor_enabled ? 'MFA đang bật' : 'Chưa bật MFA'}
          </span>
        </div>
      ),
    },
    {
      title: 'Hoạt động',
      key: 'activity',
      width: 180,
      render: (_, row) => (
        <div className="account-security-stack">
          <span>{`${row.active_session_count} phiên hoạt động`}</span>
          <span className="text-slate-500">{formatAdminDate(row.last_activity_at)}</span>
        </div>
      ),
    },
    {
      title: 'Ngày tạo',
      dataIndex: 'date_joined',
      width: 150,
      render: (value) => formatAdminDate(value),
    },
    {
      title: '',
      key: 'actions',
      fixed: 'right',
      width: 132,
      render: (_, row) => {
        const menuItems = [
          ...(canEdit(row) ? [{
            key: 'edit',
            icon: <EditOutlined />,
            label: 'Sửa hồ sơ',
            onClick: () => onEdit(row),
          }] : []),
          ...(canManageSecurity(row) ? [{
            key: 'security',
            icon: <SafetyCertificateOutlined />,
            label: 'Truy cập & bảo mật',
            onClick: () => onSecurity(row),
          }] : []),
        ]
        return (
          <Space size={4}>
            <Tooltip title="Xem nhanh">
              <Button
                type="text"
                aria-label="Xem nhanh"
                icon={<EyeOutlined />}
                onClick={() => onQuickView(row)}
              />
            </Tooltip>
            <Tooltip title="Mở trang chi tiết">
              <Button
                type="text"
                aria-label="Mở trang chi tiết"
                icon={<SafetyCertificateOutlined />}
                onClick={() => onOpenDetail(row)}
              />
            </Tooltip>
            {menuItems.length > 0 && (
              <Dropdown menu={{ items: menuItems }} trigger={['click']}>
                <Tooltip title="Thao tác khác">
                  <Button
                    type="text"
                    aria-label="Thao tác khác"
                    icon={<MoreOutlined />}
                  />
                </Tooltip>
              </Dropdown>
            )}
          </Space>
        )
      },
    },
  ]

  return (
    <div className="overflow-x-auto">
      <Table
        rowKey="public_id"
        loading={loading}
        dataSource={data.results}
        columns={columns}
        scroll={{ x: 1280 }}
        pagination={{
          current: page,
          total: data.count,
          pageSize: 20,
          showSizeChanger: false,
          showTotal: (total) => `${total.toLocaleString('vi-VN')} tài khoản`,
          onChange: onPageChange,
        }}
      />
    </div>
  )
}
