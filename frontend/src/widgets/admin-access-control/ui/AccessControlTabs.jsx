import { Tabs } from 'antd'
import MembershipPanel from './MembershipPanel'
import ProvisioningScopePanel from './ProvisioningScopePanel'
import { DepartmentPanel, RolePanel } from './StructurePanels'

export default function AccessControlTabs({
  isSuperuser,
  activeKey,
  onChange,
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
          onReplace={membership.onReplace}
          onImpact={membership.onImpact}
        />
      ),
    }, {
      key: 'provisioning',
      label: 'Cấp tài khoản',
      children: <ProvisioningScopePanel />,
    }] : []),
  ]

  return (
    <Tabs
      activeKey={activeKey}
      items={items}
      destroyOnHidden={false}
      onChange={onChange}
    />
  )
}
