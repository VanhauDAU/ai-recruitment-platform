/* oxlint-disable react/only-export-components -- Lazy route registry exports component values. */
import { lazy } from 'react'

export const AdminLoginPage = lazy(() => import('@/pages/admin/auth/Login'))
export const AdminDashboardPage = lazy(() => import('@/pages/admin/dashboard/Dashboard'))
export const AdminCompaniesPage = lazy(() => import('@/pages/admin/companies/Companies'))
export const AdminCompanyDetailPage = lazy(() => import('@/pages/admin/companies/CompanyDetail'))
export const AdminSettingsPage = lazy(() => import('@/pages/admin/settings/Settings'))
export const AdminCvOverviewPage = lazy(() => import('@/pages/admin/cvs/CvOverview'))
export const AdminCvTemplatesPage = lazy(() => import('@/pages/admin/cvs/CvTemplates'))
export const AdminCvTemplateEditorPage = lazy(() => import('@/pages/admin/cvs/CvTemplateEditor'))
export const AdminCvPositionsPage = lazy(() => import('@/pages/admin/cvs/CvPositions'))
export const AdminCvPositionDetailPage = lazy(() => import('@/pages/admin/cvs/CvPositionDetail'))
export const AdminCvLibraryPage = lazy(() => import('@/pages/admin/cvs/CvLibrary'))
export const AdminCvUserCvsPage = lazy(() => import('@/pages/admin/cvs/CvUserCvs'))
export const AdminJobModerationPage = lazy(() => import('@/pages/admin/jobs/JobModeration'))
export const AdminJobModerationDetailPage = lazy(() => import('@/pages/admin/jobs/JobModerationDetail'))
export const AdminCompanyReportsPage = lazy(() => import('@/pages/admin/companies/CompanyReports'))
export const AdminDataRequestsPage = lazy(() => import('@/pages/admin/accounts/DataRequests'))
export const AdminBlogManagementPage = lazy(() => import('@/pages/admin/blog/BlogManagement'))
export const AdminBlogNewPage = lazy(() => import('@/pages/admin/blog/BlogNew'))
export const AdminBlogEditPage = lazy(() => import('@/pages/admin/blog/BlogEdit'))
export const AdminKnowledgeBasePage = lazy(() => import('@/pages/admin/knowledgebase/KnowledgeBase'))
export const AdminKnowledgeArticleNewPage = lazy(() => import('@/pages/admin/knowledgebase/KnowledgeArticleNew'))
export const AdminKnowledgeArticleEditPage = lazy(() => import('@/pages/admin/knowledgebase/KnowledgeArticleEdit'))
export const AdminAnnouncementsPage = lazy(() => import('@/pages/admin/announcements/Announcements'))
export const AdminBannersPage = lazy(() => import('@/pages/admin/banners/Banners'))
export const AdminCatalogPage = lazy(() => import('@/pages/admin/catalog/Catalog'))
export const AdminAccountsPage = lazy(() => import('@/pages/admin/accounts/Accounts'))
export const AdminRecruitersPage = lazy(() => import('@/pages/admin/accounts/Recruiters'))
export const AdminRecruiterDetailPage = lazy(() => import('@/pages/admin/accounts/RecruiterDetail'))
export const AdminAccountDetailPage = lazy(() => import('@/pages/admin/accounts/AccountDetail'))
export const AdminInvitationAcceptPage = lazy(() => import('@/pages/admin/auth/InvitationAccept'))
export const AdminPasswordResetPage = lazy(() => import('@/pages/admin/auth/AdminPasswordReset'))
export const AdminAccountPage = lazy(() => import('@/pages/admin/settings/AccountSettings'))
export const AdminAccessDeniedPage = lazy(() => import('@/pages/admin/auth/AccessDenied'))

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
  AdminDataRequestsPage,
  AdminBlogManagementPage,
  AdminBlogNewPage,
  AdminBlogEditPage,
  AdminKnowledgeBasePage,
  AdminKnowledgeArticleNewPage,
  AdminKnowledgeArticleEditPage,
  AdminAnnouncementsPage,
  AdminBannersPage,
  AdminCatalogPage,
  AdminAccountsPage,
  AdminRecruitersPage,
  AdminRecruiterDetailPage,
  AdminAccountDetailPage,
  AdminAccountPage,
  AdminAccessDeniedPage,
}
