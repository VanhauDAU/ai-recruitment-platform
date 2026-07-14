import { Navigate, Route } from 'react-router-dom'
import { ACCOUNT_DEFAULT_PATH, ACCOUNT_LAYOUT_ITEMS, ACCOUNT_ROOT } from '@/entities/account'
import { employerAppPath } from '@/shared/config/portals'
import AuthGuard from '@/app/router/guards/AuthGuard'
import RoleGuard from '@/app/router/guards/RoleGuard'
import {
  AccountPlaceholderPage,
  BlogCategoryPage,
  BlogDetailPage,
  BlogHomePage,
  CandidateAccountLayout,
  ForgotPasswordPage,
  HomePage,
  JobDetailPage,
  JobListPage,
  MainLoginPage,
  MainRegisterPage,
  OAuthCallbackPage,
  CookiePolicyPage,
  CvEditorPlaceholderPage,
  OnboardUserPage,
  OnboardUserSettingPage,
  PersonalInfoPage,
  JobPreferenceSettingsPage,
  TwoFactorAuthenticationPage,
  ResetPasswordPage,
  SavedJobsPage,
  TemplateCatalogPage,
  TemplateDetailPage,
  VerifyEmailPage,
} from '../lazy/main.pages'
import { AuthLayout, MainLayout, OnboardingLayout } from '../lazy/layouts'

// Trang tài khoản đã xây thật, map theo item.key trong candidate-menu; key nào
// chưa có ở đây thì dùng AccountPlaceholderPage.
const ACCOUNT_PAGE_BY_KEY = {
  'personal-info': PersonalInfoPage,
  'two-factor': TwoFactorAuthenticationPage,
  'suggestion-settings': JobPreferenceSettingsPage,
}

// Route cổng main (ứng viên + khách). Xem thêm employer.routes/admin.routes.
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
      <Route path="/chinh-sach-cookie" element={<CookiePolicyPage />} />
      {/* Cẩm nang nghề nghiệp (blog). "danh-muc" là segment tĩnh nên ưu tiên
          hơn /blog/:slug, không cần lo thứ tự khai báo. */}
      <Route path="/blog" element={<BlogHomePage />} />
      <Route path="/blog/danh-muc/:categorySlug" element={<BlogCategoryPage />} />
      <Route path="/blog/:slug" element={<BlogDetailPage />} />
      <Route path="/tai-khoan/xac-thuc-email" element={<VerifyEmailPage />} />
      <Route path="/mau-cv" element={<TemplateCatalogPage />} />
      <Route path="/mau-cv/:slug" element={<TemplateDetailPage />} />
      <Route path="/cv-templates" element={<TemplateCatalogPage />} />
      <Route path="/cv-templates/:slug" element={<TemplateDetailPage />} />

      {/* Cụm trang tài khoản ứng viên — layout 3 cột, chỉ candidate đã đăng
          nhập. Route con sinh từ entities/account/config (một nguồn duy nhất);
          khi xây trang thật thì thay AccountPlaceholderPage bằng component riêng. */}
      <Route element={<AuthGuard />}>
        <Route element={<RoleGuard allowedRoles={['candidate']} />}>
          <Route path="/cvs/:publicId/edit" element={<CvEditorPlaceholderPage />} />
          <Route element={<CandidateAccountLayout />}>
            <Route path={ACCOUNT_ROOT} element={<Navigate to={ACCOUNT_DEFAULT_PATH} replace />} />
            {ACCOUNT_LAYOUT_ITEMS.map((item) => {
              const Page = ACCOUNT_PAGE_BY_KEY[item.key]
              return (
                <Route
                  key={item.key}
                  path={item.path}
                  element={Page ? <Page /> : <AccountPlaceholderPage title={item.label} />}
                />
              )
            })}
          </Route>
        </Route>
      </Route>
    </Route>,

    <Route key="candidate-onboarding" element={<AuthGuard />}>
      <Route element={<RoleGuard allowedRoles={['candidate']} />}>
        <Route element={<OnboardingLayout />}>
          <Route path="/onboard-user" element={<OnboardUserPage />} />
          <Route path="/onboard-user-setting" element={<OnboardUserSettingPage />} />
        </Route>
      </Route>
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
