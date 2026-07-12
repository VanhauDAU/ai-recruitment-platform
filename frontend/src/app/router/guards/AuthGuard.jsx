import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth, withReturnUrl } from '@/features/auth'
import PageLoading from '@/components/ui/PageLoading'

// Chỉ quyết định trạng thái session. Role/portal được giao cho RoleGuard.
export default function AuthGuard({ loginPath = '/login', children }) {
  const { loading, isAuthenticated } = useAuth()
  const location = useLocation()

  if (loading) return <PageLoading />
  if (!isAuthenticated) {
    const returnUrl = `${location.pathname}${location.search}${location.hash}`
    return <Navigate to={withReturnUrl(loginPath, returnUrl)} replace />
  }

  return children || <Outlet />
}
