import permissionCatalog from './admin-permissions.generated.json'

const MODULE_LABELS = {
  admin_access: 'Quản lý phân quyền',
  audit_log: 'Lịch sử hệ thống',
  blog: 'Bài viết',
  consultation_lead: 'Lead tư vấn',
  cv_template: 'Catalogue CV',
  dashboard: 'Tổng quan',
  job_moderation: 'Kiểm duyệt tin',
  service_catalog: 'Dịch vụ nhà tuyển dụng',
  site_setting: 'Cài đặt hệ thống',
}

export function groupPermissionsByModule(codes) {
  const allowed = new Set(codes)
  const groups = new Map()
  permissionCatalog.forEach((permission) => {
    if (!allowed.has(permission.code)) return
    const group = groups.get(permission.module) || {
      key: permission.module,
      label: MODULE_LABELS[permission.module] || permission.module,
      permissions: [],
    }
    group.permissions.push(permission)
    groups.set(permission.module, group)
  })
  return [...groups.values()]
}
