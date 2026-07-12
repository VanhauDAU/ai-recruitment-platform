import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import PageLoading from '@/components/ui/PageLoading'
import { IS_ADMIN_HOST, IS_EMPLOYER_HOST, IS_MAIN_HOST } from '@/config/portals'
import { mainRoutes } from '@/routes/MainRoutes'
import { employerRoutes } from '@/routes/EmployerRoutes'
import { adminRoutes } from '@/routes/AdminRoutes'

const NotFound = lazy(() => import('@/pages/NotFound'))

// Compose portal routes; individual route files keep URL definitions local.
export default function AppRouter() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Routes>
        {IS_MAIN_HOST && mainRoutes()}
        {!IS_ADMIN_HOST && employerRoutes()}
        {!IS_EMPLOYER_HOST && adminRoutes()}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  )
}
