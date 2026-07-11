import { Navigate, Route } from 'react-router-dom'
import { employerAppPath } from '../config/portals'
import AuthLayout from '../layouts/AuthLayout'
import MainLayout from '../layouts/MainLayout'
import {
  ForgotPasswordPage,
  HomePage,
  JobDetailPage,
  JobListPage,
  MainLoginPage,
  MainRegisterPage,
  OAuthCallbackPage,
  ResetPasswordPage,
  SavedJobsPage,
  VerifyEmailPage,
} from './lazyPages'

// Route cổng main (ứng viên + khách). Xem thêm EmployerRoutes / AdminRoutes.
export function mainRoutes() {
  return [
    <Route key="main" element={<MainLayout />}>
      <Route path="/" element={<HomePage />} />
      <Route path="/viec-lam" element={<JobListPage />} />
      <Route path="/viec-lam-da-luu" element={<SavedJobsPage />} />
      <Route path="/viec-lam/tai/:locationSlug" element={<JobListPage />} />
      <Route path="/viec-lam/:slug" element={<JobDetailPage />} />
      {/* Tin của công ty có trang thương hiệu — cùng JobDetailPage nhưng kèm
          header thương hiệu + URL riêng /brand/... */}
      <Route path="/brand/:companySlug/tuyen-dung/:slug" element={<JobDetailPage />} />
      <Route path="/jobs" element={<JobListPage />} />
      <Route path="/jobs/:slug" element={<JobDetailPage />} />
      <Route path="/tai-khoan/xac-thuc-email" element={<VerifyEmailPage />} />
    </Route>,

    <Route key="auth" element={<AuthLayout />}>
      <Route path="/login" element={<MainLoginPage />} />
      <Route path="/sign-up" element={<MainRegisterPage />} />
      <Route path="/register" element={<MainRegisterPage />} />
      {/* Dùng chung cho cả 3 cổng: link trong email luôn trỏ về host chính. */}
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
    </Route>,

    <Route key="oauth-callback" path="/oauth/callback" element={<OAuthCallbackPage portal="main" loginPath="/login" />} />,

    <Route key="employer-redirect" path="/employer/dashboard" element={<Navigate to={employerAppPath('/dashboard')} replace />} />,
  ]
}

export default mainRoutes
