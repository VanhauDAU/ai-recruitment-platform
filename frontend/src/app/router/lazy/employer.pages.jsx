/* oxlint-disable react/only-export-components -- Lazy route registry exports component values. */
import { lazy } from 'react'

export const EmployerLandingPage = lazy(() => import('@/pages/employer/marketing/Landing'))
export const EmployerAboutPage = lazy(() => import('@/pages/employer/marketing/About'))
export const EmployerServicesPage = lazy(() => import('@/pages/employer/marketing/Services'))
export const EmployerPricingPage = lazy(() => import('@/pages/employer/marketing/Pricing'))
export const EmployerContactPage = lazy(() => import('@/pages/employer/marketing/Contact'))
export const EmployerLegalPage = lazy(() => import('@/pages/employer/marketing/Legal'))
export const EmployerLoginPage = lazy(() => import('@/pages/employer/app/Login'))
export const EmployerRegisterPage = lazy(() => import('@/pages/employer/app/Register'))
export const EmployerOnboardingPage = lazy(() => import('@/pages/employer/app/Onboarding'))
export const EmployerConsultingNeedPage = lazy(() => import('@/pages/employer/app/ConsultingNeed'))
export const EmployerDashboardPage = lazy(() => import('@/pages/employer/app/Dashboard'))
