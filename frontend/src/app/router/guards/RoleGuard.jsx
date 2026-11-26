import { Navigate, Outlet } from 'react-router'
import { useSession } from '@/entities/account/session'

// Chỉ quyết định role/portal sau khi AuthGuard đã xác nhận session.
export default function RoleGuard({ allowedRoles, loginPath = '/dang-nhap', children }) {
  const { user } = useSession()

  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    return <Navigate to={loginPath} replace />
  }

  return children || <Outlet />
}
