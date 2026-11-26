import { Navigate, useLocation } from 'react-router'
import NotFound from '@/pages/common/not-found/NotFound'
import { resolveLegacyPath } from './legacy-paths'

/** Path cũ → path hiện hành (giữ query, hash); path lạ → trang 404. */
export default function LegacyPathFallback() {
  const { pathname, search, hash } = useLocation()
  const target = resolveLegacyPath(pathname)
  return target ? <Navigate to={`${target}${search}${hash}`} replace /> : <NotFound />
}
