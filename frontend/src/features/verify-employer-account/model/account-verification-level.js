export const EMPLOYER_ACCOUNT_VERIFICATION_LEVEL_STEPS = [
  'email_verified',
  'business_doc_approved',
  'no_report_history',
]

const TOTAL_LEVELS = 3

export function getEmployerAccountVerificationLevel(verification = {}) {
  const emailVerified = Boolean(verification.email_verified)
  const phoneVerified = Boolean(verification.phone_verified)
  const businessDocumentApproved = Boolean(verification.business_doc_approved)
  const noReportHistory = Boolean(verification.no_report_history)

  let level = 0
  if (emailVerified) level = 1
  if (emailVerified && phoneVerified && businessDocumentApproved) level = 2
  if (level === 2 && noReportHistory) level = 3

  return {
    level,
    total: TOTAL_LEVELS,
    percent: Math.round((level / TOTAL_LEVELS) * 100),
  }
}
