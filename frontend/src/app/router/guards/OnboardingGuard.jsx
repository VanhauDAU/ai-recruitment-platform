import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/features/auth'
import { getOnboardingDecision } from '@/features/onboarding'

// Chỉ áp policy khi route tích hợp feature onboarding ở R9. Status không có
// nghĩa là allow, nhờ đó user cũ và API hiện tại không bị redirect loop.
export default function OnboardingGuard({ onboardingPath, homePath = '/', children }) {
  const { user } = useAuth()
  const { pathname } = useLocation()
  const decision = getOnboardingDecision({
    status: user?.onboarding_status,
    pathname,
    onboardingPath,
    homePath,
  })

  if (decision.type === 'redirect') return <Navigate to={decision.to} replace />
  return children || <Outlet />
}
