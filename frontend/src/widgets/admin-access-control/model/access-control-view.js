export function pagedResults(data) {
  return Array.isArray(data) ? data : (data?.results || [])
}

export function activeRoleOptions(departments, roles, excludedRolePublicId = '') {
  return departments
    .filter((department) => department.is_active)
    .map((department) => ({
      label: department.name,
      options: roles
        .filter((role) => (
          role.is_active
          && role.public_id !== excludedRolePublicId
          && role.department.public_id === department.public_id
        ))
        .map((role) => ({ value: role.public_id, label: role.name })),
    }))
    .filter((group) => group.options.length > 0)
}

export const IMPACT_COPY = {
  departmentStatus: { title: 'Xác nhận đổi trạng thái phòng ban', ok: 'Xác nhận đổi trạng thái' },
  roleStatus: { title: 'Xác nhận đổi trạng thái chức danh', ok: 'Xác nhận đổi trạng thái' },
  rolePermissions: { title: 'Xác nhận thay đổi quyền', ok: 'Lưu thay đổi quyền' },
  assignment: { title: 'Xác nhận thay đổi chức danh', ok: 'Xác nhận thay đổi' },
  revoke: { title: 'Xác nhận thu hồi chức danh', ok: 'Thu hồi chức danh' },
  departmentRestore: { title: 'Khôi phục phòng ban mặc định', ok: 'Khôi phục mặc định' },
  roleRestore: { title: 'Khôi phục chức danh mặc định', ok: 'Khôi phục mặc định' },
}
