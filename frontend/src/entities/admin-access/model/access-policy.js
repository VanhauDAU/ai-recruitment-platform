export function canAccessAdminRoute(route, { has, isSuperuser }) {
  const permissionAllowed = Array.isArray(route.permissionsAny)
    ? route.permissionsAny.some((permission) => has(permission))
    : route.permission === null || has(route.permission)
  return (
    permissionAllowed
    && (!route.requireSuperuser || isSuperuser)
  )
}

export function firstAccessibleAdminRoute(routes, adminAccess) {
  return routes.find(
    (route) => route.showInNav && canAccessAdminRoute(route, adminAccess),
  )
}
