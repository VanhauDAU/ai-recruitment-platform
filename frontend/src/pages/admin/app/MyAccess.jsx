import { Alert, Card, Col, List, Row, Tag, Typography } from 'antd'
import {
  DepartmentBadge,
  groupPermissionsByModule,
  useAdminAccess,
} from '@/entities/admin-access'
import { useSession } from '@/entities/session'

export default function MyAccess() {
  const { user } = useSession()
  const adminAccess = useAdminAccess(user)
  const groups = groupPermissionsByModule(adminAccess.permissions)

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Typography.Title level={2} className="!mb-1">Quyền của tôi</Typography.Title>
        <Typography.Text type="secondary">
          Phòng ban, chức danh và phạm vi thao tác đang hiệu lực.
        </Typography.Text>
      </div>

      {!adminAccess.isSuperuser && adminAccess.memberships.length === 0 && (
        <Alert
          showIcon
          type="warning"
          message="Tài khoản chưa được gán phòng ban"
          description="Liên hệ quản trị hệ thống (superuser) để được cấp quyền."
        />
      )}

      {adminAccess.isSuperuser && (
        <Alert
          showIcon
          type="info"
          message="Superuser"
          description="Tài khoản có quyền truy cập toàn bộ khu vực quản trị."
        />
      )}

      {adminAccess.primaryDepartment && (
        <Card title="Phòng ban chính">
          <DepartmentBadge
            primaryDepartment={adminAccess.primaryDepartment}
            memberships={adminAccess.memberships}
          />
        </Card>
      )}

      {adminAccess.memberships.length > 0 && (
        <Card title="Chức danh đang hiệu lực">
          <List
            dataSource={adminAccess.memberships}
            renderItem={(membership) => (
              <List.Item>
                <List.Item.Meta
                  title={membership.department.name}
                  description={`${membership.role.name} · rank ${membership.role.rank}`}
                />
              </List.Item>
            )}
          />
        </Card>
      )}

      <Row gutter={[16, 16]}>
        {groups.map((group) => (
          <Col xs={24} md={12} key={group.key}>
            <Card title={group.label} className="h-full">
              <div className="flex flex-wrap gap-2">
                {group.permissions.map((permission) => (
                  <Tag key={permission.code}>{permission.label}</Tag>
                ))}
              </div>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  )
}
