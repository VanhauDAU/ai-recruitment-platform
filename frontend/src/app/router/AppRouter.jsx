import { Suspense } from 'react'
import { Route, Routes } from 'react-router'
import PageLoading from '@/shared/ui/PageLoading'
import { IS_ADMIN_HOST, IS_EMPLOYER_HOST, IS_MAIN_HOST } from '@/shared/config/portals'
import MaintenanceGate from './MaintenanceGate'
import { NotFoundPage } from './lazy/common.pages'
import { adminRoutes, employerRoutes, mainRoutes } from './routes'

// Compose portal routes; individual route files keep URL definitions local.
export default function AppRouter() {
  return (
    <MaintenanceGate>
      <Suspense fallback={<PageLoading />}>
        <Routes>
          {IS_MAIN_HOST && mainRoutes()}
          {!IS_ADMIN_HOST && employerRoutes()}
          {!IS_EMPLOYER_HOST && adminRoutes()}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </MaintenanceGate>
  )
}
