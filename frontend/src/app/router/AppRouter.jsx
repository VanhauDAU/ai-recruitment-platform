import { Suspense } from 'react'
import { Route, Routes } from 'react-router'
import PageLoading from '@/shared/ui/PageLoading'
import { IS_MAIN_HOST, SERVES_ADMIN, SERVES_EMPLOYER } from '@/shared/config/portals'
import MaintenanceGate from './MaintenanceGate'
import { LegacyPathFallbackPage } from './lazy/common.pages'
import { adminRoutes, employerRoutes, mainRoutes } from './routes'

// Compose portal routes; individual route files keep URL definitions local.
export default function AppRouter() {
  return (
    <MaintenanceGate>
      <Suspense fallback={<PageLoading />}>
        <Routes>
          {IS_MAIN_HOST && mainRoutes()}
          {SERVES_EMPLOYER && employerRoutes()}
          {SERVES_ADMIN && adminRoutes()}
          <Route path="*" element={<LegacyPathFallbackPage />} />
        </Routes>
      </Suspense>
    </MaintenanceGate>
  )
}
