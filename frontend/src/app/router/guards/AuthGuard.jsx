import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/features/auth'
import PageLoading from '@/components/ui/PageLoading'

// Chỉ quyết định trạng thái session. Role/portal được giao cho RoleGuard.
export default function AuthGuard({ loginPath = '/login', children }) {
  const { loading, isAuthenticated } = useAuth()

  if (loading) return <PageLoading />
  if (!isAuthenticated) return <Navigate to={loginPath} replace />

  return children || <Outlet />
}
