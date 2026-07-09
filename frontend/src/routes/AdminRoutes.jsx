import { lazy } from 'react'
import { Navigate, Route } from 'react-router-dom'
import { adminPath } from '../config/portals'
import AuthLayout from '../layouts/AuthLayout'
import DashboardLayout from '../layouts/DashboardLayout'
import ProtectedRoute from './ProtectedRoute'

const AdminLogin = lazy(() => import('../pages/admin/app/Login'))
const AdminDashboard = lazy(() => import('../pages/admin/app/Dashboard'))
const AdminSettings = lazy(() => import('../pages/admin/app/Settings'))

export default function AdminRoutes() {
  return (
    <>
      <Route element={<AuthLayout />}>
        <Route path={adminPath('/login')} element={<AdminLogin />} />
      </Route>

      <Route path="/admin" element={<Navigate to={adminPath('/login')} replace />} />
      <Route path="/admin/login" element={<Navigate to={adminPath('/login')} replace />} />
      <Route path="/admin/dashboard" element={<Navigate to={adminPath('/dashboard')} replace />} />
      <Route path="/admin/settings" element={<Navigate to={adminPath('/settings')} replace />} />
      <Route path={adminPath('')} element={<Navigate to={adminPath('/login')} replace />} />

      <Route element={<ProtectedRoute allowedRoles={['admin']} loginPath={adminPath('/login')} />}>
        <Route element={<DashboardLayout />}>
          <Route path={adminPath('/dashboard')} element={<AdminDashboard />} />
          <Route path={adminPath('/settings')} element={<AdminSettings />} />
        </Route>
      </Route>
    </>
  )
}
