import { Navigate, Route } from 'react-router'
import { employerAppPath, employerMarketingPath } from '@/shared/config/portals'
import AuthGuard from '../guards/AuthGuard'
import CandidateDataGuard from '../guards/CandidateDataGuard'
import EmployerOnboardingGuard from '../guards/EmployerOnboardingGuard'
import GuestGuard from '../guards/GuestGuard'
import JobWorkspaceGuard from '../guards/JobWorkspaceGuard'
import RoleGuard from '../guards/RoleGuard'
import {
  EmployerAboutPage,
  EmployerActivitiesPage,
  EmployerApplicationListPage,
  EmployerApplicationReviewPage,
  EmployerCandidateBlocksPage,
  EmployerCandidateSearchPage,
  EmployerTalentPoolPage,
  EmployerAccountInformationPage,
  EmployerBusinessLicensePage,
  EmployerCompanySettingsPage,
  EmployerCompanyWorkspacePage,
  EmployerCampaignDetailPage,
  EmployerCampaignSetupPage,
  EmployerCampaignListPage,
  EmployerConnectPage,
  EmployerContactPage,
  EmployerConsultingNeedPage,
  EmployerDashboardPage,
  EmployerGeneralSettingsPage,
  EmployerIntegrationsPage,
  EmployerJobDetailPage,
  EmployerJobFormPage,
  EmployerJobListPage,
  EmployerLandingPage,
  EmployerLegalPage,
  EmployerLoginPage,
  EmployerOnboardingPage,
  EmployerNotificationsPage,
  EmployerPasswordLoginPage,
  EmployerPersonalDataProtectionPage,
  EmployerRecruitmentDemandPage,
  EmployerPhoneVerifyPage,
  EmployerRegisterPage,
  EmployerServicesPage,
  EmployerVerifyPage,
} from '../lazy/employer.pages.js'
import { ForgotPasswordPage, OAuthCallbackPage, ResetPasswordPage, VerifyEmailPage } from '../lazy/main.pages.js'
import { DashboardLayout, EmployerAuthLayout, EmployerMarketingLayout, EmployerSetupLayout } from '../lazy/layouts.js'

export function employerRoutes() {
  return [
    <Route key="employer-marketing" element={<EmployerMarketingLayout />}>
      <Route path={employerMarketingPath('')} element={<EmployerLandingPage />} />
      <Route path={employerMarketingPath('/gioi-thieu')} element={<EmployerAboutPage />} />
      <Route path={employerMarketingPath('/dich-vu')} element={<EmployerServicesPage />} />
      <Route path={employerMarketingPath('/lien-he')} element={<EmployerContactPage />} />
      <Route path={employerMarketingPath('/dieu-khoan-dich-vu')} element={<EmployerLegalPage />} />
      <Route path={employerMarketingPath('/chinh-sach-quyen-rieng')} element={<EmployerLegalPage />} />
    </Route>,

    // Bearer-link page for invited reviewers: no session, no portal chrome.
    <Route
      key="employer-application-review"
      path={employerMarketingPath('/danh-gia-ho-so/:token')}
      element={<EmployerApplicationReviewPage />}
    />,

    <Route key="employer-auth" element={<EmployerAuthLayout />}>
      <Route element={<GuestGuard allowedRoles={['employer']} />}>
        <Route path={employerAppPath('/dang-nhap')} element={<EmployerLoginPage />} />
        <Route path={employerAppPath('/dang-ky')} element={<EmployerRegisterPage />} />
      </Route>
      <Route path={employerAppPath('/quen-mat-khau')} element={<ForgotPasswordPage loginPath={employerAppPath('/dang-nhap')} />} />
      <Route path={employerAppPath('/dat-lai-mat-khau')} element={<ResetPasswordPage requestPath={employerAppPath('/quen-mat-khau')} />} />
    </Route>,

    <Route key="employer-email-verification" element={<EmployerSetupLayout />}>
      <Route
        path={employerAppPath('/xac-thuc-email')}
        element={(
          <VerifyEmailPage
            homePath={employerAppPath('/khai-bao-nhu-cau')}
            loginPath={employerAppPath('/dang-nhap')}
            verificationPath={employerAppPath('/xac-thuc-email')}
            successActionLabel="Tiếp tục khai báo nhu cầu tuyển dụng"
            verifiedActionLabel="Khai báo nhu cầu tuyển dụng"
          />
        )}
      />
    </Route>,

    <Route
      key="employer-oauth-callback"
      path={employerAppPath('/oauth/callback')}
      element={<OAuthCallbackPage portal="employer" loginPath={employerAppPath('/dang-nhap')} />}
    />,

    <Route key="employer-redirect-login" path={employerMarketingPath('/login')} element={<Navigate to={employerAppPath('/dang-nhap')} replace />} />,
    <Route key="employer-redirect-register" path={employerMarketingPath('/register')} element={<Navigate to={employerAppPath('/dang-ky')} replace />} />,
    <Route key="employer-redirect-dashboard" path={employerMarketingPath('/dashboard')} element={<Navigate to={employerAppPath('/tong-quan')} replace />} />,
    <Route key="employer-app-root" path={employerAppPath('')} element={<Navigate to={employerAppPath('/dang-nhap')} replace />} />,

    <Route key="employer-authenticated" element={<AuthGuard loginPath={employerAppPath('/dang-nhap')} />}>
      <Route element={<RoleGuard allowedRoles={['employer']} loginPath={employerAppPath('/dang-nhap')} />}>
        <Route element={<EmployerAuthLayout />}>
          <Route path={employerAppPath('/hoan-thien-ho-so')} element={<EmployerOnboardingPage />} />
        </Route>
        <Route element={<EmployerSetupLayout />}>
          <Route path={employerAppPath('/khai-bao-nhu-cau')} element={<EmployerConsultingNeedPage />} />
        </Route>
        <Route element={<EmployerOnboardingGuard />}>
          <Route element={<DashboardLayout />}>
            <Route path={employerAppPath('/xac-thuc-tai-khoan')} element={<EmployerVerifyPage />} />
            <Route path={employerAppPath('/xac-thuc-so-dien-thoai')} element={<EmployerPhoneVerifyPage />} />
            <Route path={employerAppPath('/cai-dat/thong-tin-tai-khoan')} element={<EmployerAccountInformationPage />} />
            <Route path={employerAppPath('/cai-dat/mat-khau')} element={<EmployerPasswordLoginPage />} />
            <Route path={employerAppPath('/cai-dat/cong-ty')} element={<EmployerCompanySettingsPage />} />
            <Route path={employerAppPath('/cai-dat/giay-phep-kinh-doanh')} element={<EmployerBusinessLicensePage />} />
            <Route path={employerAppPath('/cai-dat/bao-ve-du-lieu-ca-nhan')} element={<EmployerPersonalDataProtectionPage />} />
            <Route path={employerAppPath('/cai-dat/nhu-cau-tuyen-dung')} element={<EmployerRecruitmentDemandPage />} />
            <Route path={employerAppPath('/cai-dat/chung')} element={<EmployerGeneralSettingsPage />} />
            <Route path={employerAppPath('/cai-dat/tich-hop')} element={<EmployerIntegrationsPage />} />
            <Route path={employerAppPath('/tong-quan')} element={<EmployerDashboardPage />} />
            <Route path={employerAppPath('/thong-bao')} element={<EmployerNotificationsPage />} />
            <Route path={employerAppPath('/lich-su-hoat-dong')} element={<EmployerActivitiesPage />} />
            <Route path={employerAppPath('/trang-cong-ty')} element={<EmployerCompanyWorkspacePage />} />
            <Route element={<JobWorkspaceGuard />}>
              <Route path={employerAppPath('/chien-dich')} element={<EmployerCampaignListPage />} />
              <Route path={employerAppPath('/chien-dich/tao-moi')} element={<EmployerCampaignSetupPage />} />
              <Route path={employerAppPath('/chien-dich/:publicId/thiet-lap')} element={<EmployerCampaignSetupPage />} />
              <Route path={employerAppPath('/chien-dich/:publicId')} element={<EmployerCampaignDetailPage />} />
              <Route path={employerAppPath('/tin-tuyen-dung')} element={<EmployerJobListPage />} />
              <Route path={employerAppPath('/tin-tuyen-dung/tao-moi')} element={<EmployerJobFormPage />} />
              <Route path={employerAppPath('/tin-tuyen-dung/:publicId/chinh-sua')} element={<EmployerJobFormPage />} />
              <Route path={employerAppPath('/tin-tuyen-dung/:publicId')} element={<EmployerJobDetailPage />} />
              <Route element={<CandidateDataGuard />}>
                <Route path={employerAppPath('/ho-so-ung-tuyen')} element={<EmployerApplicationListPage />} />
                <Route path={employerAppPath('/ung-vien-bi-chan')} element={<EmployerCandidateBlocksPage />} />
                <Route path={employerAppPath('/kho-ung-vien')} element={<EmployerTalentPoolPage />} />
                <Route path={employerAppPath('/tim-ung-vien')} element={<EmployerCandidateSearchPage />} />
                <Route path={employerAppPath('/procv-connect')} element={<EmployerConnectPage />} />
                <Route path={employerAppPath('/procv-connect/:conversationId')} element={<EmployerConnectPage />} />
              </Route>
            </Route>
          </Route>
        </Route>
      </Route>
    </Route>,
  ]
}
