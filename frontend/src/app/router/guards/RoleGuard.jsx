import { Navigate, Outlet } from 'react-router-dom'
import { useSession } from '@/entities/session'

// Chỉ quyết định role/portal sau khi AuthGuard đã xác nhận session.
export default function RoleGuard({ allowedRoles, loginPath = '/login', children }) {
  const { user } = useSession()

  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    return <Navigate to={loginPath} replace />
  }

  return children || <Outlet />
}
