import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { withReturnUrl } from '@/features/auth'
import { useSession } from '@/entities/session'
import PageLoading from '@/shared/ui/PageLoading'

// Chỉ quyết định trạng thái session. Role/portal được giao cho RoleGuard.
export default function AuthGuard({ loginPath = '/login', children }) {
  const { loading, isAuthenticated } = useSession()
  const location = useLocation()

  if (loading) return <PageLoading />
  if (!isAuthenticated) {
    const returnUrl = `${location.pathname}${location.search}${location.hash}`
    return <Navigate to={withReturnUrl(loginPath, returnUrl)} replace />
  }

  return children || <Outlet />
}
