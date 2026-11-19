export function canAccessAdminRoute(route, { isSuperuser }) {
  return !route.requireSuperuser || isSuperuser
}

export function firstAccessibleAdminRoute(routes, adminAccess) {
  return routes.find(
    (route) => route.showInNav && canAccessAdminRoute(route, adminAccess),
  )
}
