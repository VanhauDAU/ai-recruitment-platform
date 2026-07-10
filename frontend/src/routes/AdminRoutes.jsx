import { Navigate, Route } from 'react-router-dom'
import { adminPath } from '../config/portals'
import AuthLayout from '../layouts/AuthLayout'
import DashboardLayout from '../layouts/DashboardLayout'
import ProtectedRoute from './ProtectedRoute'
import { AdminDashboardPage, AdminLoginPage, AdminSettingsPage } from './lazyPages'

export function adminRoutes() {
  return [
    <Route key="admin-auth" element={<AuthLayout />}>
      <Route path={adminPath('/login')} element={<AdminLoginPage />} />
    </Route>,

    <Route key="admin-redirect-root" path="/admin" element={<Navigate to={adminPath('/login')} replace />} />,
    <Route key="admin-redirect-login" path="/admin/login" element={<Navigate to={adminPath('/login')} replace />} />,
    <Route key="admin-redirect-dashboard" path="/admin/dashboard" element={<Navigate to={adminPath('/dashboard')} replace />} />,
    <Route key="admin-redirect-settings" path="/admin/settings" element={<Navigate to={adminPath('/settings')} replace />} />,
    <Route key="admin-app-root" path={adminPath('')} element={<Navigate to={adminPath('/login')} replace />} />,

    <Route key="admin-protected" element={<ProtectedRoute allowedRoles={['admin']} loginPath={adminPath('/login')} />}>
      <Route element={<DashboardLayout />}>
        <Route path={adminPath('/dashboard')} element={<AdminDashboardPage />} />
        <Route path={adminPath('/settings')} element={<AdminSettingsPage />} />
      </Route>
    </Route>,
  ]
}
