import {
  createAdminMembership,
  getDepartmentRestoreImpact,
  getDepartmentStatusImpact,
  getMembershipAssignmentImpact,
  getMembershipRevokeImpact,
  getRolePermissionsImpact,
  getRoleRestoreImpact,
  getRoleStatusImpact,
  restoreAdminDepartment,
  restoreAdminRole,
  revokeAdminMembership,
  setAdminDepartmentStatus,
  setAdminRoleStatus,
  updateAdminRolePermissions,
} from '@/entities/admin-access'

export async function fetchImpact(descriptor) {
  const { kind, target, payload = {} } = descriptor
  if (kind === 'departmentStatus') {
    return getDepartmentStatusImpact(target.public_id, payload.is_active)
  }
  if (kind === 'roleStatus') return getRoleStatusImpact(target.public_id, payload.is_active)
  if (kind === 'rolePermissions') {
    return getRolePermissionsImpact(target.public_id, payload.permission_codes)
  }
  if (kind === 'assignment') return getMembershipAssignmentImpact(payload)
  if (kind === 'revoke') return getMembershipRevokeImpact(target.public_id)
  if (kind === 'departmentRestore') return getDepartmentRestoreImpact(target.public_id)
  if (kind === 'roleRestore') return getRoleRestoreImpact(target.public_id)
  throw new Error('Unknown impact action')
}

export async function confirmImpact(descriptor, impactToken) {
  const { kind, target, payload = {} } = descriptor
  if (kind === 'departmentStatus') {
    return setAdminDepartmentStatus(target.public_id, payload.is_active, impactToken)
  }
  if (kind === 'roleStatus') {
    return setAdminRoleStatus(target.public_id, payload.is_active, impactToken)
  }
  if (kind === 'rolePermissions') {
    return updateAdminRolePermissions(
      target.public_id,
      payload.permission_codes,
      impactToken,
    )
  }
  if (kind === 'assignment') return createAdminMembership(payload, impactToken)
  if (kind === 'revoke') return revokeAdminMembership(target.public_id, impactToken)
  if (kind === 'departmentRestore') return restoreAdminDepartment(target.public_id, impactToken)
  if (kind === 'roleRestore') return restoreAdminRole(target.public_id, impactToken)
  throw new Error('Unknown impact action')
}
