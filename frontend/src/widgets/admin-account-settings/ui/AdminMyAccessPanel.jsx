import { Alert, Card, Col, Row, Tag } from 'antd'
import { groupPermissionsByModule, useAdminAccess } from '@/entities/admin-access'
import { useSession } from '@/entities/session'
import { primaryDepartmentLabel } from '../model/department-label'

export default function AdminMyAccessPanel() {
  const { user } = useSession()
  const adminAccess = useAdminAccess(user)
  const groups = groupPermissionsByModule(adminAccess.permissions)

  return (
    <div className="space-y-5">
      {!adminAccess.isSuperuser && adminAccess.memberships.length === 0 && (
        <Alert
          showIcon
          type="warning"
          title="Tài khoản chưa được gán phòng ban"
          description="Liên hệ quản trị hệ thống (superuser) để được cấp quyền."
        />
      )}

      {adminAccess.isSuperuser && (
        <Alert
          showIcon
          type="info"
          title="Superuser"
          description="Tài khoản có quyền truy cập toàn bộ khu vực quản trị."
        />
      )}

      {adminAccess.primaryDepartment && (
        <Card title="Phòng ban chính">
          <Tag color="green">
            {primaryDepartmentLabel(adminAccess.primaryDepartment, adminAccess.memberships)}
          </Tag>
        </Card>
      )}

      {adminAccess.memberships.length > 0 && (
        <Card title="Chức danh đang hiệu lực">
          <ul className="m-0 list-none divide-y divide-slate-100 p-0">
            {adminAccess.memberships.map((membership) => (
              <li key={`${membership.department.code}-${membership.role.code}`} className="py-3 first:pt-0 last:pb-0">
                <p className="m-0 font-semibold text-slate-800">{membership.department.name}</p>
                <p className="mb-0 mt-1 text-sm text-slate-500">
                  {membership.role.name} · rank {membership.role.rank}
                </p>
              </li>
            ))}
          </ul>
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
