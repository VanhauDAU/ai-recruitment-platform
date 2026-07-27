import { Navigate, Outlet } from 'react-router'
import { getAuthDestination } from '@/features/auth'
import { useSession } from '@/entities/session'
import PageLoading from '@/shared/ui/PageLoading'
import { resolveAdminDestination } from '../admin/admin-destination'

// Chặn trang đăng nhập/đăng ký khi đã có phiên của ĐÚNG portal. Không chặn
// phiên role khác để candidate và employer vẫn có thể đăng nhập độc lập.
export default function GuestGuard({ allowedRoles, children }) {
  const { loading, isAuthenticated, user } = useSession()

  if (loading) return <PageLoading />

  const isAuthenticatedForPortal = isAuthenticated
    && (!allowedRoles || allowedRoles.includes(user?.role))

  if (isAuthenticatedForPortal) {
    const destination = user?.role === 'admin'
      ? resolveAdminDestination(user)
      : getAuthDestination({ user })
    return <Navigate to={destination} replace />
  }

  return children || <Outlet />
}
