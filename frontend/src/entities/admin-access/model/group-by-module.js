import permissionCatalog from './admin-permissions.generated.json'
import { MODULE_LABELS } from './module-labels'

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
