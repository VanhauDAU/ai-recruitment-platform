import { Navigate, useLocation } from 'react-router'
import NotFound from '@/pages/common/not-found/NotFound'
import { resolveLegacyPath } from './legacy-paths'

/** Path cũ → path hiện hành (giữ query, hash); path lạ → trang 404. */
export default function LegacyPathFallback() {
  const { pathname, search, hash } = useLocation()
  const target = resolveLegacyPath(pathname)
  if (!target) return <NotFound />
  const url = `${target}${search}${hash}`
  // Đích ở subdomain khác: tải lại trang tại đó (router chỉ điều hướng trong host).
  if (/^https?:\/\//.test(target)) {
    window.location.replace(url)
    return null
  }
  return <Navigate to={url} replace />
}
