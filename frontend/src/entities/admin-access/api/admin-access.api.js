import client from '@/shared/api/client'

async function data(request) {
  const response = await request
  return response.data
}

export function getAdminDepartments({ signal } = {}) {
  return data(client.get('/admin/departments/', { signal }))
}

export function createAdminDepartment(payload) {
  return data(client.post('/admin/departments/', payload))
}

export function updateAdminDepartment(publicId, payload) {
  return data(client.patch(`/admin/departments/${publicId}/`, payload))
}

export function getDepartmentStatusImpact(publicId, isActive) {
  return data(client.post(`/admin/departments/${publicId}/status-impact/`, {
    is_active: isActive,
  }))
}

export function setAdminDepartmentStatus(publicId, isActive, impactToken) {
  const action = isActive ? 'activate' : 'deactivate'
  return data(client.post(`/admin/departments/${publicId}/${action}/`, {
    impact_token: impactToken,
  }))
}

export function getDepartmentRestoreImpact(publicId) {
  return data(client.get(`/admin/departments/${publicId}/restore-system-default/`))
}

export function restoreAdminDepartment(publicId, impactToken) {
  return data(client.post(`/admin/departments/${publicId}/restore-system-default/`, {
    impact_token: impactToken,
  }))
}

export function getAdminRoles(department = '', { signal } = {}) {
  return data(client.get('/admin/roles/', {
    params: department ? { department } : {},
    signal,
  }))
}

export function createAdminRole(payload) {
  return data(client.post('/admin/roles/', payload))
}

export function updateAdminRole(publicId, payload) {
  return data(client.patch(`/admin/roles/${publicId}/`, payload))
}

export function getRoleStatusImpact(publicId, isActive) {
  return data(client.post(`/admin/roles/${publicId}/status-impact/`, {
    is_active: isActive,
  }))
}

export function setAdminRoleStatus(publicId, isActive, impactToken) {
  const action = isActive ? 'activate' : 'deactivate'
  return data(client.post(`/admin/roles/${publicId}/${action}/`, {
    impact_token: impactToken,
  }))
}

export function getAdminPermissions(rolePublicId, { signal } = {}) {
  return data(client.get('/admin/permissions/', {
    params: rolePublicId ? { role: rolePublicId } : {},
    signal,
  }))
}

export function getRolePermissionsImpact(publicId, permissionCodes) {
  return data(client.post(`/admin/roles/${publicId}/permissions-impact/`, {
    permission_codes: permissionCodes,
  }))
}

export function updateAdminRolePermissions(publicId, permissionCodes, impactToken) {
  return data(client.put(`/admin/roles/${publicId}/permissions/`, {
    permission_codes: permissionCodes,
    impact_token: impactToken,
  }))
}

export function getRoleRestoreImpact(publicId) {
  return data(client.get(`/admin/roles/${publicId}/restore-system-default/`))
}

export function restoreAdminRole(publicId, impactToken) {
  return data(client.post(`/admin/roles/${publicId}/restore-system-default/`, {
    impact_token: impactToken,
  }))
}

export function getAdminMemberships({
  q = '',
  department = '',
  role = '',
  status = 'active',
  ordering = '-assigned_at',
  page = 1,
} = {}, { signal } = {}) {
  return data(client.get('/admin/memberships/', {
    params: {
      page,
      status,
      ordering,
      ...(q ? { q } : {}),
      ...(department ? { department } : {}),
      ...(role ? { role } : {}),
    },
    signal,
  }))
}

export function getMembershipAssignmentImpact(payload) {
  return data(client.post('/admin/memberships/assignment-impact/', payload))
}

export function createAdminMembership(payload, impactToken) {
  return data(client.post('/admin/memberships/', {
    ...payload,
    impact_token: impactToken,
  }))
}

export function getMembershipRevokeImpact(publicId) {
  return data(client.get(`/admin/memberships/${publicId}/revoke-impact/`))
}

export function revokeAdminMembership(publicId, impactToken) {
  return data(client.post(`/admin/memberships/${publicId}/revoke/`, {
    impact_token: impactToken,
  }))
}

export function getAdminStaff(query = '', { signal } = {}) {
  return data(client.get('/admin/staff/', {
    params: query ? { q: query } : {},
    signal,
  }))
}

// `scope: 'all'` cần quyền `audit_log.view`; mặc định chỉ trả log của chính mình.
export function getAdminAuditLogs({ scope = 'mine', action = '', page = 1, signal } = {}) {
  return data(client.get('/admin/audit-logs/', {
    params: {
      page,
      ...(scope === 'all' ? { scope: 'all' } : {}),
      ...(action ? { action } : {}),
    },
    signal,
  }))
}
