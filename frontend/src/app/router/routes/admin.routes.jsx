import { Navigate, Route } from 'react-router-dom'
import { adminPath } from '@/shared/config/portals'
import AuthGuard from '@/app/router/guards/AuthGuard'
import RoleGuard from '@/app/router/guards/RoleGuard'
import {
  AdminConsultationLeadsPage,
  AdminCvCataloguePage,
  AdminDashboardPage,
  AdminEmployerServicesPage,
  AdminLoginPage,
  AdminSettingsPage,
} from '../lazy/admin.pages'
import { AuthLayout, DashboardLayout } from '../lazy/layouts'

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

    <Route key="admin-authenticated" element={<AuthGuard loginPath={adminPath('/login')} />}>
      <Route element={<RoleGuard allowedRoles={['admin']} loginPath={adminPath('/login')} />}>
        <Route element={<DashboardLayout />}>
          <Route path={adminPath('/dashboard')} element={<AdminDashboardPage />} />
          <Route path={adminPath('/settings')} element={<AdminSettingsPage />} />
          <Route path={adminPath('/cv-catalogue')} element={<AdminCvCataloguePage />} />
          <Route path={adminPath('/services')} element={<AdminEmployerServicesPage />} />
          <Route path={adminPath('/consultation-leads')} element={<AdminConsultationLeadsPage />} />
        </Route>
      </Route>
    </Route>,
  ]
}
