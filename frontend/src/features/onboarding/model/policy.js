export const ONBOARDING_PENDING_STATUSES = new Set(['not_started', 'in_progress'])
export const ONBOARDING_TERMINAL_STATUSES = new Set(['completed', 'skipped'])

export function getOnboardingDecision({ status, pathname, onboardingPath, homePath }) {
  // Chưa có status (user cũ hoặc API trước R9) => luôn cho đi tiếp.
  if (!status || !onboardingPath) return { type: 'allow' }

  const isOnboardingRoute = pathname === onboardingPath || pathname.startsWith(`${onboardingPath}/`)
  if (ONBOARDING_PENDING_STATUSES.has(status) && !isOnboardingRoute) {
    return { type: 'redirect', to: onboardingPath }
  }
  if (ONBOARDING_TERMINAL_STATUSES.has(status) && isOnboardingRoute) {
    return { type: 'redirect', to: homePath }
  }
  return { type: 'allow' }
}
