/* oxlint-disable react/only-export-components -- Lazy route registry exports component values. */
import { lazy } from 'react'

export const AdminLoginPage = lazy(() => import('@/pages/admin/app/Login'))
export const AdminDashboardPage = lazy(() => import('@/pages/admin/app/Dashboard'))
export const AdminCompaniesPage = lazy(() => import('@/pages/admin/app/Companies'))
export const AdminCompanyDetailPage = lazy(() => import('@/pages/admin/app/CompanyDetail'))
export const AdminSettingsPage = lazy(() => import('@/pages/admin/app/Settings'))
export const AdminCvOverviewPage = lazy(() => import('@/pages/admin/app/CvOverview'))
export const AdminCvTemplatesPage = lazy(() => import('@/pages/admin/app/CvTemplates'))
export const AdminCvTemplateEditorPage = lazy(() => import('@/pages/admin/app/CvTemplateEditor'))
export const AdminCvPositionsPage = lazy(() => import('@/pages/admin/app/CvPositions'))
export const AdminCvPositionDetailPage = lazy(() => import('@/pages/admin/app/CvPositionDetail'))
export const AdminCvLibraryPage = lazy(() => import('@/pages/admin/app/CvLibrary'))
export const AdminCvUserCvsPage = lazy(() => import('@/pages/admin/app/CvUserCvs'))
export const AdminJobModerationPage = lazy(() => import('@/pages/admin/app/JobModeration'))
export const AdminJobModerationDetailPage = lazy(() => import('@/pages/admin/app/JobModerationDetail'))
export const AdminCompanyReportsPage = lazy(() => import('@/pages/admin/app/CompanyReports'))
export const AdminBlogManagementPage = lazy(() => import('@/pages/admin/app/BlogManagement'))
export const AdminBlogNewPage = lazy(() => import('@/pages/admin/app/BlogNew'))
export const AdminBlogEditPage = lazy(() => import('@/pages/admin/app/BlogEdit'))
export const AdminKnowledgeBasePage = lazy(() => import('@/pages/admin/app/KnowledgeBase'))
export const AdminKnowledgeArticleNewPage = lazy(() => import('@/pages/admin/app/KnowledgeArticleNew'))
export const AdminKnowledgeArticleEditPage = lazy(() => import('@/pages/admin/app/KnowledgeArticleEdit'))
export const AdminAnnouncementsPage = lazy(() => import('@/pages/admin/app/Announcements'))
export const AdminAccessControlPage = lazy(() => import('@/pages/admin/app/AccessControl'))
export const AdminAccountsPage = lazy(() => import('@/pages/admin/app/Accounts'))
export const AdminRecruitersPage = lazy(() => import('@/pages/admin/app/Recruiters'))
export const AdminRecruiterDetailPage = lazy(() => import('@/pages/admin/app/RecruiterDetail'))
export const AdminAccountDetailPage = lazy(() => import('@/pages/admin/app/AccountDetail'))
export const AdminInvitationAcceptPage = lazy(() => import('@/pages/admin/app/InvitationAccept'))
export const AdminPasswordResetPage = lazy(() => import('@/pages/admin/app/AdminPasswordReset'))
export const AdminAccountPage = lazy(() => import('@/pages/admin/app/AccountSettings'))
export const AdminAccessDeniedPage = lazy(() => import('@/pages/admin/app/AccessDenied'))

export const ADMIN_PAGE_BY_KEY = {
  AdminDashboardPage,
  AdminCompaniesPage,
  AdminCompanyDetailPage,
  AdminSettingsPage,
  AdminCvOverviewPage,
  AdminCvTemplatesPage,
  AdminCvTemplateEditorPage,
  AdminCvPositionsPage,
  AdminCvPositionDetailPage,
  AdminCvLibraryPage,
  AdminCvUserCvsPage,
  AdminJobModerationPage,
  AdminJobModerationDetailPage,
  AdminCompanyReportsPage,
  AdminBlogManagementPage,
  AdminBlogNewPage,
  AdminBlogEditPage,
  AdminKnowledgeBasePage,
  AdminKnowledgeArticleNewPage,
  AdminKnowledgeArticleEditPage,
  AdminAnnouncementsPage,
  AdminAccessControlPage,
  AdminAccountsPage,
  AdminRecruitersPage,
  AdminRecruiterDetailPage,
  AdminAccountDetailPage,
  AdminAccountPage,
  AdminAccessDeniedPage,
}
