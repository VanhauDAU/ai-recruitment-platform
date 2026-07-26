import { Navigate, Route } from 'react-router-dom'
import { adminPath } from '@/shared/config/portals'
import AuthGuard from '../guards/AuthGuard'
import GuestGuard from '../guards/GuestGuard'
import PermissionGuard from '../guards/PermissionGuard'
import RoleGuard from '../guards/RoleGuard'
import {
  ADMIN_PAGE_BY_KEY,
  AdminInvitationAcceptPage,
  AdminLoginPage,
  AdminPasswordResetPage,
} from '../lazy/admin.pages'
import { AuthLayout, DashboardLayout } from '../lazy/layouts'
import { ADMIN_ROUTES } from '../admin/admin-routes.config'
import { resolveAdminDestination } from '../admin/admin-destination'

export function adminRoutes() {
  return [
    <Route key="admin-auth" element={<AuthLayout />}>
      <Route
        path={adminPath('/invitation')}
        element={<AdminInvitationAcceptPage />}
      />
      <Route
        path={adminPath('/reset-password')}
        element={<AdminPasswordResetPage />}
      />
      <Route element={<GuestGuard allowedRoles={['admin']} />}>
        <Route
          path={adminPath('/login')}
          element={<AdminLoginPage destinationResolver={resolveAdminDestination} />}
        />
      </Route>
    </Route>,

    <Route key="admin-redirect-root" path="/admin" element={<Navigate to={adminPath('/login')} replace />} />,
    <Route key="admin-redirect-login" path="/admin/login" element={<Navigate to={adminPath('/login')} replace />} />,
    <Route key="admin-redirect-dashboard" path="/admin/dashboard" element={<Navigate to={adminPath('/dashboard')} replace />} />,
    <Route key="admin-redirect-settings" path="/admin/settings" element={<Navigate to={adminPath('/settings')} replace />} />,
    // Trang "Quyền của tôi" đã gộp vào tab của Cài đặt tài khoản.
    <Route key="admin-redirect-my-access" path={adminPath('/my-access')} element={<Navigate to={`${adminPath('/account')}?tab=access`} replace />} />,
    <Route key="admin-app-root" path={adminPath('')} element={<Navigate to={adminPath('/login')} replace />} />,

    <Route key="admin-authenticated" element={<AuthGuard loginPath={adminPath('/login')} />}>
      <Route element={<RoleGuard allowedRoles={['admin']} loginPath={adminPath('/login')} />}>
        <Route element={<DashboardLayout />}>
          {ADMIN_ROUTES.map((route) => {
            const Page = ADMIN_PAGE_BY_KEY[route.lazyKey]
            return (
              <Route
                key={route.segment}
                path={adminPath(route.segment)}
                element={(
                  <PermissionGuard route={route}>
                    <Page />
                  </PermissionGuard>
                )}
              />
            )
          })}
        </Route>
      </Route>
    </Route>,
  ]
}
