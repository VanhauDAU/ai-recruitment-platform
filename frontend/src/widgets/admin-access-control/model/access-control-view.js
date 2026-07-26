export function pagedResults(data) {
  return Array.isArray(data) ? data : (data?.results || [])
}

export function activeRoleOptions(departments, roles) {
  const activeDepartmentIds = new Set(
    departments
      .filter((department) => department.is_active)
      .map((department) => department.public_id),
  )
  return roles
    .filter((role) => role.is_active && activeDepartmentIds.has(role.department.public_id))
    .map((role) => ({
      value: role.public_id,
      label: `${role.department.name} · ${role.name}`,
    }))
}

export const IMPACT_COPY = {
  departmentStatus: { title: 'Xác nhận đổi trạng thái phòng ban', ok: 'Xác nhận đổi trạng thái' },
  roleStatus: { title: 'Xác nhận đổi trạng thái chức danh', ok: 'Xác nhận đổi trạng thái' },
  rolePermissions: { title: 'Xác nhận thay đổi quyền', ok: 'Lưu thay đổi quyền' },
  assignment: { title: 'Xác nhận gán chức danh', ok: 'Gán chức danh' },
  revoke: { title: 'Xác nhận thu hồi chức danh', ok: 'Thu hồi chức danh' },
  primary: { title: 'Xác nhận đổi phòng ban chính', ok: 'Đặt làm phòng ban chính' },
  departmentRestore: { title: 'Khôi phục phòng ban mặc định', ok: 'Khôi phục mặc định' },
  roleRestore: { title: 'Khôi phục chức danh mặc định', ok: 'Khôi phục mặc định' },
}
