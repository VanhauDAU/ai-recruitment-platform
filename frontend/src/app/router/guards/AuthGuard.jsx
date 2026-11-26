import { Navigate, Outlet, useLocation } from 'react-router'
import { withReturnUrl } from '@/features/common/account/auth'
import { useSession } from '@/entities/account/session'
import PageLoading from '@/shared/ui/PageLoading'

// Chỉ quyết định trạng thái session. Role/portal được giao cho RoleGuard.
export default function AuthGuard({ loginPath = '/dang-nhap', children }) {
  const { loading, isAuthenticated } = useSession()
  const location = useLocation()

  if (loading) return <PageLoading />
  if (!isAuthenticated) {
    const returnUrl = `${location.pathname}${location.search}${location.hash}`
    return <Navigate to={withReturnUrl(loginPath, returnUrl)} replace />
  }

  return children || <Outlet />
}
