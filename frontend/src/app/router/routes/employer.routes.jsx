import { Navigate, Route } from 'react-router-dom'
import { employerAppPath, employerMarketingPath } from '@/shared/config/portals'
import AuthGuard from '@/app/router/guards/AuthGuard'
import EmployerOnboardingGuard from '@/app/router/guards/EmployerOnboardingGuard'
import GuestGuard from '@/app/router/guards/GuestGuard'
import RoleGuard from '@/app/router/guards/RoleGuard'
import EmployerLegacyVerifyRedirect from '../redirects/EmployerLegacyVerifyRedirect'
import {
  EmployerAboutPage,
  EmployerAccountInformationPage,
  EmployerBusinessLicensePage,
  EmployerCompanySettingsPage,
  EmployerContactPage,
  EmployerConsultingNeedPage,
  EmployerDashboardPage,
  EmployerGeneralSettingsPage,
  EmployerLandingPage,
  EmployerLegalPage,
  EmployerLoginPage,
  EmployerOnboardingPage,
  EmployerPasswordLoginPage,
  EmployerPersonalDataProtectionPage,
  EmployerPhoneVerifyPage,
  EmployerPricingPage,
  EmployerRegisterPage,
  EmployerServicesPage,
  EmployerVerifyPage,
} from '../lazy/employer.pages'
import { ForgotPasswordPage, OAuthCallbackPage, ResetPasswordPage, VerifyEmailPage } from '../lazy/main.pages'
import { DashboardLayout, EmployerAuthLayout, EmployerMarketingLayout, EmployerSetupLayout } from '../lazy/layouts'

export function employerRoutes() {
  return [
    <Route key="employer-marketing" element={<EmployerMarketingLayout />}>
      <Route path={employerMarketingPath('')} element={<EmployerLandingPage />} />
      <Route path={employerMarketingPath('/gioi-thieu')} element={<EmployerAboutPage />} />
      <Route path={employerMarketingPath('/dich-vu')} element={<EmployerServicesPage />} />
      <Route path={employerMarketingPath('/bao-gia')} element={<EmployerPricingPage />} />
      <Route path={employerMarketingPath('/lien-he')} element={<EmployerContactPage />} />
      <Route path={employerMarketingPath('/dieu-khoan-dich-vu')} element={<EmployerLegalPage />} />
      <Route path={employerMarketingPath('/chinh-sach-quyen-rieng')} element={<EmployerLegalPage />} />
    </Route>,

    <Route key="employer-auth" element={<EmployerAuthLayout />}>
      <Route element={<GuestGuard allowedRoles={['employer']} />}>
        <Route path={employerAppPath('/login')} element={<EmployerLoginPage />} />
        <Route path={employerAppPath('/register')} element={<EmployerRegisterPage />} />
      </Route>
      <Route path={employerAppPath('/forgot-password')} element={<ForgotPasswordPage loginPath={employerAppPath('/login')} />} />
      <Route path={employerAppPath('/reset-password')} element={<ResetPasswordPage requestPath={employerAppPath('/forgot-password')} />} />
    </Route>,

    <Route key="employer-email-verification" element={<EmployerSetupLayout />}>
      <Route
        path={employerAppPath('/account/verify')}
        element={(
          <VerifyEmailPage
            homePath={employerAppPath('/consulting-need')}
            loginPath={employerAppPath('/login')}
            verificationPath={employerAppPath('/account/verify')}
            successActionLabel="Tiếp tục khai báo nhu cầu tuyển dụng"
            verifiedActionLabel="Khai báo nhu cầu tuyển dụng"
          />
        )}
      />
      <Route path={employerAppPath('/xac-thuc-email')} element={<EmployerLegacyVerifyRedirect />} />
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
        <Route element={<EmployerAuthLayout />}>
          <Route path={employerAppPath('/account/complete-profile')} element={<EmployerOnboardingPage />} />
          <Route path={employerAppPath('/onboarding')} element={<EmployerOnboardingPage />} />
        </Route>
        <Route element={<EmployerSetupLayout />}>
          <Route path={employerAppPath('/consulting-need')} element={<EmployerConsultingNeedPage />} />
        </Route>
        <Route element={<EmployerOnboardingGuard />}>
          <Route element={<DashboardLayout />}>
            <Route path={employerAppPath('/employer-verify')} element={<EmployerVerifyPage />} />
            <Route path={employerAppPath('/account/phone-verify')} element={<EmployerPhoneVerifyPage />} />
            <Route path={employerAppPath('/account/settings/account-info')} element={<EmployerAccountInformationPage />} />
            <Route path={employerAppPath('/account/settings/password-login')} element={<EmployerPasswordLoginPage />} />
            <Route path={employerAppPath('/account/settings/company')} element={<EmployerCompanySettingsPage />} />
            <Route path={employerAppPath('/account/settings/gpkd')} element={<EmployerBusinessLicensePage />} />
            <Route path={employerAppPath('/account/settings/personal-data-protection')} element={<EmployerPersonalDataProtectionPage />} />
            <Route path={employerAppPath('/account/settings/general-setting')} element={<EmployerGeneralSettingsPage />} />
            <Route path={employerAppPath('/dashboard')} element={<EmployerDashboardPage />} />
          </Route>
        </Route>
      </Route>
    </Route>,
  ]
}
