export function canAccessAdminRoute(route, { has, isSuperuser }) {
  return (
    (route.permission === null || has(route.permission))
    && (!route.requireSuperuser || isSuperuser)
  )
}

export function firstAccessibleAdminRoute(routes, adminAccess) {
  return routes.find(
    (route) => route.showInNav && canAccessAdminRoute(route, adminAccess),
  )
}
