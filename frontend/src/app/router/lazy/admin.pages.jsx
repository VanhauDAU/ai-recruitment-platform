/* oxlint-disable react/only-export-components -- Lazy route registry exports component values. */
import { lazy } from 'react'

export const AdminLoginPage = lazy(() => import('@/pages/admin/app/Login'))
export const AdminDashboardPage = lazy(() => import('@/pages/admin/app/Dashboard'))
export const AdminSettingsPage = lazy(() => import('@/pages/admin/app/Settings'))
export const AdminCvCataloguePage = lazy(() => import('@/pages/admin/app/CvCatalogue'))
