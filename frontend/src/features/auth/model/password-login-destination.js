import { HOME_BY_ROLE } from '@/shared/config/portals'

// All successful auth flows use this policy. An unconfigured candidate must
// finish onboarding before returning to a requested page or the homepage.
export function getAuthDestination({ user, returnUrl }) {
  if (user?.role === 'candidate' && !user.job_preferences_configured) return '/onboard-user'
  if (returnUrl) return returnUrl
  return HOME_BY_ROLE[user?.role] || '/'
}
