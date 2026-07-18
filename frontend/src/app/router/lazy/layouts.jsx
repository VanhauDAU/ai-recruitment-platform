/* oxlint-disable react/only-export-components -- Lazy route registry exports component values. */
import { lazy } from 'react'

export const AuthLayout = lazy(() => import('../../layouts/AuthLayout'))
export const DashboardLayout = lazy(() => import('../../layouts/DashboardLayout'))
export const EmployerMarketingLayout = lazy(() => import('../../layouts/EmployerMarketingLayout'))
export const EmployerAuthLayout = lazy(() => import('../../layouts/EmployerAuthLayout'))
export const EmployerSetupLayout = lazy(() => import('../../layouts/EmployerSetupLayout'))
export const MainLayout = lazy(() => import('../../layouts/MainLayout'))
export const OnboardingLayout = lazy(() => import('../../layouts/OnboardingLayout'))
