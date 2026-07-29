/* oxlint-disable react/only-export-components -- Lazy route registry exports component values. */
import { lazy } from 'react'

export const AdminLoginPage = lazy(() => import('@/pages/admin/app/Login'))
export const AdminDashboardPage = lazy(() => import('@/pages/admin/app/Dashboard'))
export const AdminCompaniesPage = lazy(() => import('@/pages/admin/app/Companies'))
export const AdminCompanyDetailPage = lazy(() => import('@/pages/admin/app/CompanyDetail'))
export const AdminSettingsPage = lazy(() => import('@/pages/admin/app/Settings'))
export const AdminCvCataloguePage = lazy(() => import('@/pages/admin/app/CvCatalogue'))
export const AdminEmployerServicesPage = lazy(() => import('@/pages/admin/app/EmployerServices'))
export const AdminConsultationLeadsPage = lazy(() => import('@/pages/admin/app/ConsultationLeads'))
export const AdminJobModerationPage = lazy(() => import('@/pages/admin/app/JobModeration'))
export const AdminBlogManagementPage = lazy(() => import('@/pages/admin/app/BlogManagement'))
export const AdminBlogNewPage = lazy(() => import('@/pages/admin/app/BlogNew'))
export const AdminBlogEditPage = lazy(() => import('@/pages/admin/app/BlogEdit'))
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
  AdminCvCataloguePage,
  AdminEmployerServicesPage,
  AdminConsultationLeadsPage,
  AdminJobModerationPage,
  AdminBlogManagementPage,
  AdminBlogNewPage,
  AdminBlogEditPage,
  AdminAnnouncementsPage,
  AdminAccessControlPage,
  AdminAccountsPage,
  AdminRecruitersPage,
  AdminRecruiterDetailPage,
  AdminAccountDetailPage,
  AdminAccountPage,
  AdminAccessDeniedPage,
}
