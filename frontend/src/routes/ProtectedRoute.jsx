import { Outlet } from 'react-router-dom'
import AuthGuard from '@/app/router/guards/AuthGuard'
import RoleGuard from '@/app/router/guards/RoleGuard'

// `loginPath`: mỗi cổng (main/tuyendung/admin) redirect về trang đăng nhập của chính nó.
export default function ProtectedRoute({ allowedRoles, loginPath = '/login' }) {
  return (
    <AuthGuard loginPath={loginPath}>
      {allowedRoles ? <RoleGuard allowedRoles={allowedRoles} loginPath={loginPath} /> : <Outlet />}
    </AuthGuard>
  )
}
