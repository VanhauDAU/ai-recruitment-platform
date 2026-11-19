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
} from '@/entities/account/admin-account'
import { AccountRoleTag, AccountStatusTag } from './AccountStatusTag'
import { getIntlLocale } from '@/shared/config/i18n'
import { buildRecruiterColumns } from './recruiter-columns'

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

function Identity({ row, onQuickView, meta }) {
  return (
    <button
      type="button"
      className="account-identity"
      aria-label={`Xem nhanh ${row.full_name || row.email}`}
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
        {meta && <span className="account-identity__meta" title={meta}>{meta}</span>}
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
  quickView = true,
}) {
  const menuItems = [
    ...(!quickView ? [{
      key: 'open',
      icon: <SafetyCertificateOutlined />,
      label: 'Mở hồ sơ',
      onClick: () => onOpenDetail(row),
    }] : []),
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
      {quickView && <Tooltip title="Xem nhanh">
        <Button
          type="text"
          aria-label="Xem nhanh"
          icon={<EyeOutlined />}
          onClick={() => onQuickView(row)}
        />
      </Tooltip>}
      {quickView && <Tooltip title="Mở trang chi tiết">
        <Button
          type="text"
          aria-label="Mở trang chi tiết"
          icon={<SafetyCertificateOutlined />}
          onClick={() => onOpenDetail(row)}
        />
      </Tooltip>}
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
  originState,
  pageSize = 20,
  onPageSizeChange,
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
    width: recruiterOnly ? 56 : 132,
    render: (_, row) => (
      <ActionCell
        row={row}
        onQuickView={onQuickView}
        onOpenDetail={onOpenDetail}
        onEdit={onEdit}
        canEdit={canEdit}
        canManageSecurity={canManageSecurity}
        onSecurity={onSecurity}
        quickView={!recruiterOnly}
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
    ...buildRecruiterColumns({
      identity: commonIdentity,
      ordering,
      originState,
      renderIdentity: (row, meta) => <Identity row={row} onQuickView={onQuickView} meta={meta} />,
      sortOrder,
    }),
    actionColumn,
  ]

  return (
    <div className="overflow-x-auto">
      <Table
        rowKey="public_id"
        loading={loading}
        dataSource={data.results}
        columns={recruiterOnly ? recruiterColumns : userColumns}
        scroll={{ x: recruiterOnly ? 940 : 1250 }}
        pagination={{
          current: page,
          total: data.count,
          pageSize,
          showSizeChanger: Boolean(onPageSizeChange),
          pageSizeOptions: [20, 40, 60],
          locale: { items_per_page: '/ trang' },
          showTotal: (total) => `${total.toLocaleString(getIntlLocale())} ${resultLabel}`,
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
          if (onPageSizeChange && pagination.pageSize !== pageSize) {
            onPageSizeChange(pagination.pageSize)
            return
          }
          if (pagination.current !== page) onPageChange(pagination.current)
        }}
      />
    </div>
  )
}
