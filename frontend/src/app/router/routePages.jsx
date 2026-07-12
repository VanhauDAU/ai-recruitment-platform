/* oxlint-disable react/only-export-components -- Route registry exports LazyExoticComponent values, which Fast Refresh does not classify as components. */
import { lazy } from 'react'

const lazyFeaturePage = (loadFeature, loaderName) => lazy(() => loadFeature()
  .then((feature) => feature[loaderName]()))

// Central registry for route-level code splitting. Route definition files only
// describe navigation, while this module only exports React components.
export const HomePage = lazy(() => import('../../pages/main/Home'))
export const JobListPage = lazyFeaturePage(() => import('@/features/jobs/routes'), 'loadJobListPage')
export const JobDetailPage = lazyFeaturePage(() => import('@/features/jobs/routes'), 'loadJobDetailPage')
export const SavedJobsPage = lazyFeaturePage(() => import('@/features/jobs/routes'), 'loadSavedJobsPage')
export const MainLoginPage = lazyFeaturePage(() => import('@/features/auth/routes'), 'loadLoginPage')
export const MainRegisterPage = lazyFeaturePage(() => import('@/features/auth/routes'), 'loadRegisterPage')
export const VerifyEmailPage = lazyFeaturePage(() => import('@/features/auth/routes'), 'loadVerifyEmailPage')
export const CandidateAccountLayout = lazyFeaturePage(() => import('@/features/account/routes'), 'loadCandidateAccountLayout')
export const AccountPlaceholderPage = lazyFeaturePage(() => import('@/features/account/routes'), 'loadAccountPlaceholderPage')
// Các trang tài khoản đã xây thật (map theo item.key trong candidateMenu).
export const PersonalInfoPage = lazyFeaturePage(() => import('@/features/account/routes'), 'loadPersonalInfoPage')
export const TwoFactorAuthenticationPage = lazyFeaturePage(() => import('@/features/two-factor/routes'), 'loadTwoFactorAuthenticationPage')
export const BlogHomePage = lazy(() => import('../../pages/main/blog/BlogHome'))
export const BlogCategoryPage = lazy(() => import('../../pages/main/blog/BlogCategory'))
export const BlogDetailPage = lazy(() => import('../../pages/main/blog/BlogDetail'))
export const ForgotPasswordPage = lazyFeaturePage(() => import('@/features/auth/routes'), 'loadForgotPasswordPage')
export const ResetPasswordPage = lazyFeaturePage(() => import('@/features/auth/routes'), 'loadResetPasswordPage')
export const OAuthCallbackPage = lazyFeaturePage(() => import('@/features/auth/routes'), 'loadOAuthCallbackPage')

export const EmployerLandingPage = lazy(() => import('../../pages/employer/marketing/Landing'))
export const EmployerServicesPage = lazy(() => import('../../pages/employer/marketing/Services'))
export const EmployerPricingPage = lazy(() => import('../../pages/employer/marketing/Pricing'))
export const EmployerLoginPage = lazy(() => import('../../pages/employer/app/Login'))
export const EmployerRegisterPage = lazy(() => import('../../pages/employer/app/Register'))
export const EmployerDashboardPage = lazy(() => import('../../pages/employer/app/Dashboard'))

export const AdminLoginPage = lazy(() => import('../../pages/admin/app/Login'))
export const AdminDashboardPage = lazy(() => import('../../pages/admin/app/Dashboard'))
export const AdminSettingsPage = lazy(() => import('../../pages/admin/app/Settings'))
