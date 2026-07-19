export const EMPLOYER_ACCOUNT_VERIFICATION_LEVEL_STEPS = [
  'phone_verified',
  'company_linked',
  'business_doc_approved',
]

const TOTAL_LEVELS = 3

export function getEmployerAccountVerificationLevel(verification = {}, user = {}) {
  const emailVerified = Boolean(verification.email_verified ?? user?.email_verified)
  const phoneVerified = Boolean(verification.phone_verified)
  const businessDocumentApproved = Boolean(verification.business_doc_approved)
  const companyEmail = Boolean(verification.email_domain_verified)
  const noReportHistory = verification.no_report_history ?? true

  let level = 0
  if (emailVerified) level = 1
  if (emailVerified && phoneVerified && businessDocumentApproved) level = 2
  if (level === 2 && companyEmail && noReportHistory) level = 3

  return {
    level,
    total: TOTAL_LEVELS,
    percent: Math.round((level / TOTAL_LEVELS) * 100),
  }
}
