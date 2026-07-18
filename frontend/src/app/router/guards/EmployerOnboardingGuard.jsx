import { Navigate, Outlet } from 'react-router-dom'
import { getAuthDestination } from '@/features/auth'
import { useSession } from '@/entities/session'

// Tài khoản nhà tuyển dụng chỉ vào workspace sau khi đã xác thực email và
// hoàn tất hồ sơ bắt buộc. AuthGuard và RoleGuard luôn bao ngoài guard này.
export default function EmployerOnboardingGuard({ children }) {
  const { user } = useSession()

  if (user?.employer_onboarding_required) {
    return <Navigate to={getAuthDestination({ user, returnUrl: '' })} replace />
  }

  return children || <Outlet />
}
