export {
  canAccessAdminRoute,
  firstAccessibleAdminRoute,
} from './model/access-policy'
export { adminAccessKeys } from './api/admin-access.keys'
export {
  createAdminDepartment,
  createAdminMembership,
  createAdminRole,
  getAdminDepartments,
  getAdminMemberships,
  getAdminPermissions,
  getAdminRoles,
  getAdminStaff,
  getDepartmentRestoreImpact,
  getDepartmentStatusImpact,
  getMembershipAssignmentImpact,
  getMembershipPrimaryImpact,
  getMembershipRevokeImpact,
  getRolePermissionsImpact,
  getRoleRestoreImpact,
  getRoleStatusImpact,
  restoreAdminDepartment,
  restoreAdminRole,
  revokeAdminMembership,
  setAdminDepartmentStatus,
  setAdminMembershipPrimary,
  setAdminRoleStatus,
  updateAdminDepartment,
  updateAdminRole,
  updateAdminRolePermissions,
} from './api/admin-access.api'
export { groupPermissionsByModule } from './model/group-by-module'
export { MODULE_LABELS } from './model/module-labels'
export { createAdminAccess, useAdminAccess } from './model/use-admin-access'
export { default as DepartmentBadge } from './ui/DepartmentBadge'
export { default as adminPermissionCatalog } from './model/admin-permissions.generated.json'
