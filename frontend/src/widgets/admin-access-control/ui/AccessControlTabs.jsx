import { Tabs } from 'antd'
import MembershipPanel from './MembershipPanel'
import { DepartmentPanel, RolePanel } from './StructurePanels'

export default function AccessControlTabs({
  isSuperuser,
  department,
  role,
  membership,
}) {
  const items = [
    {
      key: 'departments',
      label: 'Phòng ban',
      children: (
        <DepartmentPanel
          departments={department.items}
          query={department.query}
          isSuperuser={isSuperuser}
          onEdit={department.onEdit}
          onImpact={department.onImpact}
        />
      ),
    },
    {
      key: 'roles',
      label: 'Chức danh',
      children: (
        <RolePanel
          roles={role.items}
          departments={department.items}
          query={role.query}
          roleFilter={role.filter}
          onRoleFilterChange={role.onFilterChange}
          isSuperuser={isSuperuser}
          onEdit={role.onEdit}
          onEditPermissions={role.onEditPermissions}
          onImpact={role.onImpact}
        />
      ),
    },
    ...(isSuperuser ? [{
      key: 'staff',
      label: 'Nhân viên',
      children: (
        <MembershipPanel
          memberships={membership.items}
          query={membership.query}
          page={membership.page}
          includeRevoked={membership.includeRevoked}
          onPageChange={membership.onPageChange}
          onIncludeRevokedChange={membership.onIncludeRevokedChange}
          onAssign={membership.onAssign}
          onImpact={membership.onImpact}
        />
      ),
    }] : []),
  ]

  return <Tabs items={items} destroyOnHidden={false} />
}
