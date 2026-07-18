import {
  EMPLOYER_ACCOUNT_VERIFY_URL,
  EMPLOYER_COMPLETE_PROFILE_URL,
  EMPLOYER_CONSULTING_NEED_URL,
  HOME_BY_ROLE,
} from '@/shared/config/portals'

// All successful auth flows use this policy. An unconfigured candidate must
// finish onboarding before returning to a requested page or the homepage.
export function getAuthDestination({ user, returnUrl }) {
  if (user?.role === 'candidate' && !user.job_preferences_configured) return '/onboard-user'
  if (user?.role === 'employer' && user.employer_onboarding_required) {
    const destinations = {
      registration: EMPLOYER_COMPLETE_PROFILE_URL,
      email_verification: EMPLOYER_ACCOUNT_VERIFY_URL,
      consulting_need: EMPLOYER_CONSULTING_NEED_URL,
    }
    return destinations[user.employer_onboarding_step] || EMPLOYER_ACCOUNT_VERIFY_URL
  }
  if (returnUrl) return returnUrl
  return HOME_BY_ROLE[user?.role] || '/'
}
