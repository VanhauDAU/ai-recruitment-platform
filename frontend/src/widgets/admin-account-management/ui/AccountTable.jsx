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

function sortOrder(ordering, key) {
  if (ordering === key) return 'ascend'
  if (ordering === `-${key}`) return 'descend'
  return null
}

function Identity({ row, onQuickView }) {
  return (
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
  )
}

function ActionCell({
  row,
  onQuickView,
  onOpenDetail,
  onEdit,
  canEdit,
  canManageSecurity,
  onSecurity,
}) {
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
            <Button type="text" aria-label="Thao tác khác" icon={<MoreOutlined />} />
          </Tooltip>
        </Dropdown>
      )}
    </Space>
  )
}

export default function AccountTable({
  data,
  loading,
  page,
  ordering,
  recruiterOnly = false,
  onPageChange,
  onOrderingChange,
  onQuickView,
  onOpenDetail,
  onEdit,
  canEdit,
  canManageSecurity,
  onSecurity,
  resultLabel = 'tài khoản',
}) {
  const commonIdentity = {
    title: recruiterOnly ? 'Nhà tuyển dụng' : 'Tài khoản',
    key: 'full_name',
    width: 280,
    sorter: true,
    sortOrder: sortOrder(ordering, 'full_name'),
    render: (_, row) => <Identity row={row} onQuickView={onQuickView} />,
  }
  const actionColumn = {
    title: '',
    key: 'actions',
    fixed: 'right',
    width: 132,
    render: (_, row) => (
      <ActionCell
        row={row}
        onQuickView={onQuickView}
        onOpenDetail={onOpenDetail}
        onEdit={onEdit}
        canEdit={canEdit}
        canManageSecurity={canManageSecurity}
        onSecurity={onSecurity}
      />
    ),
  }

  const userColumns = [
    commonIdentity,
    {
      title: 'Loại & ngữ cảnh',
      key: 'role',
      width: 235,
      sorter: true,
      sortOrder: sortOrder(ordering, 'role'),
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
      key: 'status',
      width: 145,
      sorter: true,
      sortOrder: sortOrder(ordering, 'status'),
      render: (status) => <AccountStatusTag status={status} />,
    },
    {
      title: 'Xác minh email',
      dataIndex: 'email_verified',
      key: 'email_verified',
      width: 155,
      sorter: true,
      sortOrder: sortOrder(ordering, 'email_verified'),
      render: (value) => (
        <Tag color={value ? 'green' : 'orange'}>
          {value ? 'Đã xác minh' : 'Chưa xác minh'}
        </Tag>
      ),
    },
    {
      title: 'MFA',
      dataIndex: 'two_factor_enabled',
      key: 'two_factor_enabled',
      width: 125,
      sorter: true,
      sortOrder: sortOrder(ordering, 'two_factor_enabled'),
      render: (value) => <Tag color={value ? 'green' : 'default'}>{value ? 'Đang bật' : 'Chưa bật'}</Tag>,
    },
    {
      title: 'Hoạt động gần nhất',
      dataIndex: 'last_activity_at',
      key: 'last_session_seen_at',
      width: 180,
      sorter: true,
      sortOrder: sortOrder(ordering, 'last_session_seen_at'),
      render: (value) => formatAdminDate(value),
    },
    {
      title: 'Ngày tạo',
      dataIndex: 'date_joined',
      key: 'date_joined',
      width: 155,
      sorter: true,
      sortOrder: sortOrder(ordering, 'date_joined'),
      render: (value) => formatAdminDate(value),
    },
    actionColumn,
  ]

  const recruiterColumns = [
    commonIdentity,
    {
      title: 'Công ty',
      key: 'recruiter_profile__company__company_name',
      width: 230,
      sorter: true,
      sortOrder: sortOrder(ordering, 'recruiter_profile__company__company_name'),
      render: (_, row) => (
        <div>
          <Typography.Text strong ellipsis className="!block">
            {row.context?.company?.name || 'Chưa liên kết công ty'}
          </Typography.Text>
          <Typography.Text type="secondary" className="!block !text-xs">
            {row.context?.company?.public_id || 'Cần hoàn thiện onboarding'}
          </Typography.Text>
        </div>
      ),
    },
    {
      title: 'Vai trò & chức danh',
      key: 'recruiter_profile__company_role',
      width: 190,
      sorter: true,
      sortOrder: sortOrder(ordering, 'recruiter_profile__company_role'),
      render: (_, row) => (
        <div className="space-y-1">
          <Tag color={row.context?.company_role === 'owner' ? 'blue' : 'default'}>
            {row.context?.company_role_label || 'Chưa có vai trò'}
          </Tag>
          <Typography.Text type="secondary" ellipsis className="!block !text-xs">
            {row.context?.position_title || 'Chưa cập nhật chức danh'}
          </Typography.Text>
        </div>
      ),
    },
    {
      title: 'Tài khoản',
      dataIndex: 'status',
      key: 'status',
      width: 145,
      sorter: true,
      sortOrder: sortOrder(ordering, 'status'),
      render: (status) => <AccountStatusTag status={status} />,
    },
    {
      title: 'Onboarding',
      key: 'recruiter_profile__onboarding_completed_at',
      width: 170,
      sorter: true,
      sortOrder: sortOrder(ordering, 'recruiter_profile__onboarding_completed_at'),
      render: (_, row) => (
        <div className="account-security-stack">
          <span className={row.context?.onboarding_completed ? 'is-positive' : 'is-warning'}>
            {row.context?.onboarding_completed ? 'Đã hoàn tất' : 'Chưa hoàn tất'}
          </span>
          <span>{row.email_verified ? 'Email đã xác minh' : 'Email chưa xác minh'}</span>
          <span>{row.context?.phone_verified ? 'SĐT đã xác minh' : 'SĐT chưa xác minh'}</span>
        </div>
      ),
    },
    {
      title: 'Xác thực đại diện',
      key: 'recruiter_profile__verification_case__status',
      width: 185,
      sorter: true,
      sortOrder: sortOrder(ordering, 'recruiter_profile__verification_case__status'),
      render: (_, row) => {
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
      title: 'Hoạt động gần nhất',
      dataIndex: 'last_activity_at',
      key: 'last_session_seen_at',
      width: 180,
      sorter: true,
      sortOrder: sortOrder(ordering, 'last_session_seen_at'),
      render: (value) => formatAdminDate(value),
    },
    {
      title: 'Ngày tham gia',
      dataIndex: 'date_joined',
      key: 'date_joined',
      width: 155,
      sorter: true,
      sortOrder: sortOrder(ordering, 'date_joined'),
      render: (value) => formatAdminDate(value),
    },
    actionColumn,
  ]

  return (
    <div className="overflow-x-auto">
      <Table
        rowKey="public_id"
        loading={loading}
        dataSource={data.results}
        columns={recruiterOnly ? recruiterColumns : userColumns}
        scroll={{ x: recruiterOnly ? 1530 : 1250 }}
        pagination={{
          current: page,
          total: data.count,
          pageSize: 20,
          showSizeChanger: false,
          showTotal: (total) => `${total.toLocaleString('vi-VN')} ${resultLabel}`,
        }}
        onChange={(pagination, _, sorter, extra) => {
          if (extra.action === 'sort') {
            const field = sorter.columnKey
            const next = sorter.order
              ? `${sorter.order === 'descend' ? '-' : ''}${field}`
              : '-date_joined'
            onOrderingChange(next)
            return
          }
          if (pagination.current !== page) onPageChange(pagination.current)
        }}
      />
    </div>
  )
}
