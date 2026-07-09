import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import PageLoading from '../components/ui/PageLoading'
import { IS_ADMIN_HOST, IS_EMPLOYER_HOST, IS_MAIN_HOST } from '../config/portals'
import { mainRoutes } from './MainRoutes'
import { employerRoutes } from './EmployerRoutes'
import { adminRoutes } from './AdminRoutes'

const NotFound = lazy(() => import('../pages/NotFound'))

// 3 zone theo host (xem src/config/portals.js): dev cùng host nên render cả 3
// (employer prefix /tuyendung, admin prefix /admin); khi build cho subdomain,
// zone tương ứng mount tại root và các zone khác không render.
export default function AppRoutes() {
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
