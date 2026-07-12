/* oxlint-disable react/only-export-components -- Lazy route registry exports component values. */
import { lazy } from 'react'

export const EmployerLandingPage = lazy(() => import('@/pages/employer/marketing/Landing'))
export const EmployerServicesPage = lazy(() => import('@/pages/employer/marketing/Services'))
export const EmployerPricingPage = lazy(() => import('@/pages/employer/marketing/Pricing'))
export const EmployerLoginPage = lazy(() => import('@/pages/employer/app/Login'))
export const EmployerRegisterPage = lazy(() => import('@/pages/employer/app/Register'))
export const EmployerDashboardPage = lazy(() => import('@/pages/employer/app/Dashboard'))
