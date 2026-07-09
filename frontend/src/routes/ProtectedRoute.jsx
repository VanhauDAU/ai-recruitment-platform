import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

// `loginPath`: mỗi cổng (main/tuyendung/admin) redirect về trang đăng nhập của chính nó.
export default function ProtectedRoute({ allowedRoles, loginPath = '/login' }) {
  const { user, loading, isAuthenticated } = useAuth()

  if (loading) return null
  if (!isAuthenticated) return <Navigate to={loginPath} replace />
  if (allowedRoles && !allowedRoles.includes(user.role)) return <Navigate to={loginPath} replace />

  return <Outlet />
}
