import { lazy } from 'react'
import { Navigate, Route } from 'react-router-dom'
import { employerAppPath, employerMarketingPath } from '../config/portals'
import AuthLayout from '../layouts/AuthLayout'
import DashboardLayout from '../layouts/DashboardLayout'
import EmployerMarketingLayout from '../layouts/EmployerMarketingLayout'
import ProtectedRoute from './ProtectedRoute'

const EmployerLanding = lazy(() => import('../pages/employer/marketing/Landing'))
const EmployerServices = lazy(() => import('../pages/employer/marketing/Services'))
const EmployerPricing = lazy(() => import('../pages/employer/marketing/Pricing'))
const EmployerLogin = lazy(() => import('../pages/employer/app/Login'))
const EmployerRegister = lazy(() => import('../pages/employer/app/Register'))
const EmployerDashboard = lazy(() => import('../pages/employer/app/Dashboard'))

export function employerRoutes() {
  return [
    <Route key="employer-marketing" element={<EmployerMarketingLayout />}>
      <Route path={employerMarketingPath('')} element={<EmployerLanding />} />
      <Route path={employerMarketingPath('/dich-vu')} element={<EmployerServices />} />
      <Route path={employerMarketingPath('/bao-gia')} element={<EmployerPricing />} />
    </Route>,

    <Route key="employer-auth" element={<AuthLayout />}>
      <Route path={employerAppPath('/login')} element={<EmployerLogin />} />
      <Route path={employerAppPath('/register')} element={<EmployerRegister />} />
    </Route>,

    <Route key="employer-redirect-login" path={employerMarketingPath('/login')} element={<Navigate to={employerAppPath('/login')} replace />} />,
    <Route key="employer-redirect-register" path={employerMarketingPath('/register')} element={<Navigate to={employerAppPath('/register')} replace />} />,
    <Route key="employer-redirect-dashboard" path={employerMarketingPath('/dashboard')} element={<Navigate to={employerAppPath('/dashboard')} replace />} />,
    <Route key="employer-app-root" path={employerAppPath('')} element={<Navigate to={employerAppPath('/login')} replace />} />,

    <Route key="employer-protected" element={<ProtectedRoute allowedRoles={['employer']} loginPath={employerAppPath('/login')} />}>
      <Route element={<DashboardLayout />}>
        <Route path={employerAppPath('/dashboard')} element={<EmployerDashboard />} />
      </Route>
    </Route>,
  ]
}
