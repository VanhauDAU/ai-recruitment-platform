import { m } from '@/shared/config/i18n'

export const EMPLOYER_BADGE_CRITERIA = [
  { key: 'email_domain_verified', label: m.employer_profile_badge_email_domain() },
  { key: 'phone_verified', label: m.employer_profile_badge_phone() },
  { key: 'business_doc_approved', label: m.employer_profile_badge_business_doc() },
  { key: 'account_age_reached', label: m.employer_profile_badge_account_age() },
  { key: 'no_report_history', label: m.employer_profile_badge_no_reports() },
]

export function resolveEmployerBadgeEligibility(profile = {}) {
  const explicit = profile.badge_eligibility
    ?? profile.account_verification?.badge_eligibility
    ?? profile.onboarding?.badge_eligibility
  if (explicit) {
    const labels = new Map(EMPLOYER_BADGE_CRITERIA.map((item) => [item.key, item.label]))
    return {
      ...explicit,
      verified: Boolean(explicit.verified),
      criteria: (explicit.criteria || []).map((item) => ({
        ...item,
        label: item.label || labels.get(item.key) || item.key,
        passed: Boolean(item.passed),
      })),
    }
  }

  const onboarding = profile.onboarding || {}
  const available = EMPLOYER_BADGE_CRITERIA.filter((item) => (
    Object.prototype.hasOwnProperty.call(onboarding, item.key)
  ))
  if (!available.length) return null

  const criteria = available.map((item) => ({
    ...item,
    passed: Boolean(onboarding[item.key]),
  }))
  return {
    verified: criteria.length === EMPLOYER_BADGE_CRITERIA.length
      && criteria.every((item) => item.passed),
    criteria,
  }
}
