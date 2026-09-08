export const EMPLOYER_BADGE_CRITERIA = [
  { key: 'email_domain_verified', label: 'Email tên miền công ty đã được xác minh' },
  { key: 'phone_verified', label: 'Số điện thoại đã được xác thực' },
  { key: 'business_doc_approved', label: 'Hồ sơ pháp lý/quyền đại diện đã được duyệt' },
  { key: 'account_age_reached', label: 'Tài khoản đã đạt tuổi tối thiểu' },
  { key: 'no_report_history', label: 'Không có tin vi phạm được quản trị viên xác nhận' },
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
