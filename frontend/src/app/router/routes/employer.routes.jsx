import { Navigate, Route } from 'react-router-dom'
import { employerAppPath, employerMarketingPath } from '@/shared/config/portals'
import AuthLayout from '../../../layouts/AuthLayout'
import DashboardLayout from '../../../layouts/DashboardLayout'
import EmployerMarketingLayout from '../../../layouts/EmployerMarketingLayout'
import AuthGuard from '@/app/router/guards/AuthGuard'
import RoleGuard from '@/app/router/guards/RoleGuard'
import {
  EmployerDashboardPage,
  EmployerLandingPage,
  EmployerLoginPage,
  EmployerPricingPage,
  EmployerRegisterPage,
  EmployerServicesPage,
  OAuthCallbackPage,
  VerifyEmailPage,
} from '../routePages'

export function employerRoutes() {
  return [
    <Route key="employer-marketing" element={<EmployerMarketingLayout />}>
      <Route path={employerMarketingPath('')} element={<EmployerLandingPage />} />
      <Route path={employerMarketingPath('/dich-vu')} element={<EmployerServicesPage />} />
      <Route path={employerMarketingPath('/bao-gia')} element={<EmployerPricingPage />} />
    </Route>,

    <Route key="employer-auth" element={<AuthLayout />}>
      <Route path={employerAppPath('/login')} element={<EmployerLoginPage />} />
      <Route path={employerAppPath('/register')} element={<EmployerRegisterPage />} />
      <Route
        path={employerAppPath('/xac-thuc-email')}
        element={(
          <VerifyEmailPage
            homePath={employerAppPath('/dashboard')}
            loginPath={employerAppPath('/login')}
            verificationPath={employerAppPath('/xac-thuc-email')}
          />
        )}
      />
    </Route>,

    <Route
      key="employer-oauth-callback"
      path={employerAppPath('/oauth/callback')}
      element={<OAuthCallbackPage portal="employer" loginPath={employerAppPath('/login')} />}
    />,

    <Route key="employer-redirect-login" path={employerMarketingPath('/login')} element={<Navigate to={employerAppPath('/login')} replace />} />,
    <Route key="employer-redirect-register" path={employerMarketingPath('/register')} element={<Navigate to={employerAppPath('/register')} replace />} />,
    <Route key="employer-redirect-dashboard" path={employerMarketingPath('/dashboard')} element={<Navigate to={employerAppPath('/dashboard')} replace />} />,
    <Route key="employer-app-root" path={employerAppPath('')} element={<Navigate to={employerAppPath('/login')} replace />} />,

    <Route key="employer-authenticated" element={<AuthGuard loginPath={employerAppPath('/login')} />}>
      <Route element={<RoleGuard allowedRoles={['employer']} loginPath={employerAppPath('/login')} />}>
        <Route element={<DashboardLayout />}>
          <Route path={employerAppPath('/dashboard')} element={<EmployerDashboardPage />} />
        </Route>
      </Route>
    </Route>,
  ]
}
