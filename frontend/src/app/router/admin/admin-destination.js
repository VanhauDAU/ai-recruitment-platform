import {
  createAdminAccess,
  firstAccessibleAdminRoute,
  canAccessAdminRoute,
} from '@/entities/admin-access'
import { adminPath } from '@/shared/config/portals'
import { ADMIN_ROUTES } from './admin-routes.config'

export function resolveAdminDestination(user, returnUrl) {
  const adminAccess = createAdminAccess(user)
  const requestedPath = returnUrl
    ? new URL(returnUrl, window.location.origin).pathname
    : ''
  const requestedRoute = ADMIN_ROUTES.find(
    (route) => adminPath(route.segment) === requestedPath,
  )
  if (requestedRoute && canAccessAdminRoute(requestedRoute, adminAccess)) {
    return returnUrl
  }
  const firstRoute = firstAccessibleAdminRoute(ADMIN_ROUTES, adminAccess)
  return adminPath(firstRoute?.segment || '/my-access')
}
