/* oxlint-disable react/only-export-components -- Route registry exports LazyExoticComponent values, which Fast Refresh does not classify as components. */
import { lazy } from 'react'

// Central registry for route-level code splitting. Route definition files only
// describe navigation, while this module only exports React components.
export const AuthLayout = lazy(() => import('../layouts/AuthLayout'))
export const DashboardLayout = lazy(() => import('../layouts/DashboardLayout'))
export const EmployerMarketingLayout = lazy(() => import('../layouts/EmployerMarketingLayout'))
export const MainLayout = lazy(() => import('../layouts/MainLayout'))

export const HomePage = lazy(() => import('../../pages/main/home/Home'))
export const JobListPage = lazy(() => import('../../pages/main/jobs/JobList'))
export const JobDetailPage = lazy(() => import('../../pages/main/jobs/JobDetail'))
export const SavedJobsPage = lazy(() => import('../../pages/main/jobs/SavedJobs'))
export const MainLoginPage = lazy(() => import('../../pages/main/auth/Login'))
export const MainRegisterPage = lazy(() => import('../../pages/main/auth/Register'))
export const VerifyEmailPage = lazy(() => import('../../pages/main/auth/VerifyEmail'))
export const CandidateAccountLayout = lazy(() => import('../../pages/main/account/CandidateAccountLayout'))
export const AccountPlaceholderPage = lazy(() => import('../../pages/main/account/AccountPlaceholder'))
// Các trang tài khoản đã xây thật (map theo item.key trong candidate-menu).
export const PersonalInfoPage = lazy(() => import('../../pages/main/account/PersonalInfo'))
export const TwoFactorAuthenticationPage = lazy(() => import('../../pages/main/account/TwoFactorAuthentication'))
export const BlogHomePage = lazy(() => import('../../pages/main/blog/BlogHome'))
export const BlogCategoryPage = lazy(() => import('../../pages/main/blog/BlogCategory'))
export const BlogDetailPage = lazy(() => import('../../pages/main/blog/BlogDetail'))
export const ForgotPasswordPage = lazy(() => import('../../pages/main/auth/ForgotPassword'))
export const ResetPasswordPage = lazy(() => import('../../pages/main/auth/ResetPassword'))
export const OAuthCallbackPage = lazy(() => import('../../pages/main/auth/OAuthCallback'))

export const EmployerLandingPage = lazy(() => import('../../pages/employer/marketing/Landing'))
export const EmployerServicesPage = lazy(() => import('../../pages/employer/marketing/Services'))
export const EmployerPricingPage = lazy(() => import('../../pages/employer/marketing/Pricing'))
export const EmployerLoginPage = lazy(() => import('../../pages/employer/app/Login'))
export const EmployerRegisterPage = lazy(() => import('../../pages/employer/app/Register'))
export const EmployerDashboardPage = lazy(() => import('../../pages/employer/app/Dashboard'))

export const AdminLoginPage = lazy(() => import('../../pages/admin/app/Login'))
export const AdminDashboardPage = lazy(() => import('../../pages/admin/app/Dashboard'))
export const AdminSettingsPage = lazy(() => import('../../pages/admin/app/Settings'))
