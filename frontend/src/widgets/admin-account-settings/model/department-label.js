/**
 * Nhãn "Phòng ban · Chức danh" của phòng ban chính.
 *
 * Trả chuỗi rỗng khi tài khoản chưa được gán phòng ban để nơi gọi tự quyết định
 * hiển thị trạng thái trống.
 */
export function primaryDepartmentLabel(primaryDepartment, memberships = []) {
  if (!primaryDepartment) return ''
  const primaryMembership = memberships.find(
    (membership) => membership.department.code === primaryDepartment.code,
  )
  return primaryMembership?.role?.name
    ? `${primaryDepartment.name} · ${primaryMembership.role.name}`
    : primaryDepartment.name
}
