import {
  ApartmentOutlined,
  CrownOutlined,
  KeyOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons'
import { Alert, Card, Descriptions, Empty, Tag, Typography } from 'antd'
import {
  adminPermissionCatalog,
  MODULE_LABELS,
} from '@/entities/admin-access'
import {
  formatAdminDate,
  INVITATION_STATUS_LABELS,
} from '@/entities/admin-account'

const PERMISSION_BY_CODE = new Map(
  adminPermissionCatalog.map((permission) => [permission.code, permission]),
)

function stateTag(active, activeLabel = 'Đang hiệu lực', inactiveLabel = 'Đã khóa') {
  return <Tag color={active ? 'green' : 'red'}>{active ? activeLabel : inactiveLabel}</Tag>
}

function permissionGroups(codes) {
  const groups = new Map()
  codes.forEach((code) => {
    const permission = PERMISSION_BY_CODE.get(code) || {
      code,
      module: 'other',
      label: code,
      description: 'Quyền đang hiệu lực nhưng không còn trong danh mục hiện tại.',
    }
    const current = groups.get(permission.module) || []
    current.push(permission)
    groups.set(permission.module, current)
  })
  return [...groups.entries()]
    .map(([module, permissions]) => ({
      key: module,
      label: MODULE_LABELS[module] || 'Quyền khác',
      permissions,
    }))
    .sort((left, right) => left.label.localeCompare(right.label, 'vi'))
}

function AccessSummary({ account, access, membership, groups }) {
  const source = access?.is_superuser
    ? 'Superuser'
    : membership ? 'Theo chức danh' : 'Chưa được cấp quyền'
  return (
    <div className="account-access-summary" aria-label="Tổng quan phân quyền">
      <div>
        <SafetyCertificateOutlined />
        <span>Nguồn quyền</span>
        <strong>{source}</strong>
      </div>
      <div>
        <KeyOutlined />
        <span>Quyền hiệu lực</span>
        <strong>{access?.permission_count ?? access?.permissions?.length ?? 0}</strong>
      </div>
      <div>
        <ApartmentOutlined />
        <span>Phân hệ truy cập</span>
        <strong>{groups.length}</strong>
      </div>
      <div>
        <CrownOutlined />
        <span>Trạng thái tài khoản</span>
        <strong>{account.status === 'active' ? 'Đang hoạt động' : 'Bị hạn chế'}</strong>
      </div>
    </div>
  )
}

function AssignmentCard({ membership }) {
  if (!membership) return null
  const { role } = membership
  const department = role.department
  return (
    <Card title="Chức danh và phòng ban" className="account-access-card">
      <Descriptions bordered size="small" column={{ xs: 1, lg: 2 }}>
        <Descriptions.Item label="Chức danh">
          <Typography.Text strong>{role.name}</Typography.Text>
        </Descriptions.Item>
        <Descriptions.Item label="Mã chức danh"><Typography.Text code>{role.code}</Typography.Text></Descriptions.Item>
        <Descriptions.Item label="Trạng thái chức danh">{stateTag(role.is_active)}</Descriptions.Item>
        <Descriptions.Item label="Cấp bậc">{role.rank}</Descriptions.Item>
        <Descriptions.Item label="Phòng ban">
          <Typography.Text strong>{department.name}</Typography.Text>
        </Descriptions.Item>
        <Descriptions.Item label="Mã phòng ban"><Typography.Text code>{department.code}</Typography.Text></Descriptions.Item>
        <Descriptions.Item label="Trạng thái phòng ban">{stateTag(department.is_active)}</Descriptions.Item>
        <Descriptions.Item label="Nguồn cấu hình">
          {role.is_system_managed ? 'Mặc định hệ thống' : 'Tùy chỉnh'}
        </Descriptions.Item>
        {role.description && (
          <Descriptions.Item label="Mô tả chức danh" span={2}>{role.description}</Descriptions.Item>
        )}
        {department.description && (
          <Descriptions.Item label="Mô tả phòng ban" span={2}>{department.description}</Descriptions.Item>
        )}
        <Descriptions.Item label="Gán lúc">{formatAdminDate(membership.assigned_at)}</Descriptions.Item>
        <Descriptions.Item label="Người cấp">
          {membership.assigned_by_name || membership.assigned_by_email || 'Hệ thống'}
          {membership.assigned_by_name && membership.assigned_by_email
            ? ` · ${membership.assigned_by_email}`
            : ''}
        </Descriptions.Item>
      </Descriptions>
    </Card>
  )
}

function PermissionCards({ groups }) {
  if (!groups.length) {
    return (
      <Card title="Quyền hiệu lực" className="account-access-card">
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Tài khoản chưa có quyền quản trị hiệu lực" />
      </Card>
    )
  }
  return (
    <section aria-labelledby="effective-permissions-title">
      <div className="account-access-section-heading">
        <div>
          <Typography.Title id="effective-permissions-title" level={4}>Quyền hiệu lực</Typography.Title>
          <Typography.Text type="secondary">Danh sách đầy đủ quyền tài khoản có thể sử dụng.</Typography.Text>
        </div>
        <Tag color="blue">{groups.reduce((total, group) => total + group.permissions.length, 0)} quyền</Tag>
      </div>
      <div className="account-access-permission-grid">
        {groups.map((group) => (
          <Card
            key={group.key}
            size="small"
            title={group.label}
            extra={<Tag>{group.permissions.length}</Tag>}
            className="account-access-card"
          >
            <ul className="account-access-permission-list">
              {group.permissions.map((permission) => (
                <li key={permission.code}>
                  <Typography.Text strong>{permission.label}</Typography.Text>
                  <Typography.Text type="secondary">{permission.description}</Typography.Text>
                  <Typography.Text code>{permission.code}</Typography.Text>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </section>
  )
}

function InvitationCard({ invitation }) {
  if (!invitation) return null
  return (
    <Card title="Thông tin lời mời quản trị" className="account-access-card">
      <Descriptions bordered size="small" column={{ xs: 1, lg: 2 }}>
        <Descriptions.Item label="Trạng thái">
          <Tag>{INVITATION_STATUS_LABELS[invitation.status] || invitation.status}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="Người mời">{invitation.invited_by_email || 'Hệ thống'}</Descriptions.Item>
        <Descriptions.Item label="Hết hạn">{formatAdminDate(invitation.expires_at)}</Descriptions.Item>
        <Descriptions.Item label="Chấp nhận lúc">{formatAdminDate(invitation.accepted_at)}</Descriptions.Item>
      </Descriptions>
    </Card>
  )
}

export default function AdminAccountAccessPanel({ account }) {
  const access = account.admin_access || {}
  const membership = access.membership
  const permissionCodes = access.permissions || membership?.role?.permission_codes || []
  const groups = permissionGroups(permissionCodes)

  return (
    <div className="account-access-panel">
      {access.is_superuser && (
        <Alert
          showIcon
          type="info"
          title="Toàn quyền Superuser"
          description="Tài khoản được truy cập toàn bộ phân hệ và không phụ thuộc quyền của chức danh."
        />
      )}
      {!access.is_superuser && !membership && (
        <Alert
          showIcon
          type="warning"
          title="Chưa có chức danh hiệu lực"
          description="Tài khoản Admin chưa được gán phòng ban, chức danh và không có quyền quản trị hiệu lực."
        />
      )}
      <AccessSummary account={account} access={access} membership={membership} groups={groups} />
      <AssignmentCard membership={membership} />
      <PermissionCards groups={groups} />
      <InvitationCard invitation={account.invitation} />
    </div>
  )
}
