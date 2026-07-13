import { HOME_BY_ROLE } from '@/shared/config/portals'

// Social OAuth owns its own navigation in OAuthCallback. This policy applies
// only after a successful email/password login (including password + 2FA).
export function getPasswordLoginDestination({ user, returnUrl }) {
  if (user?.role === 'candidate' && !user.job_preferences_configured) return '/onboard-user'
  if (returnUrl) return returnUrl
  return HOME_BY_ROLE[user?.role] || '/'
}
