export const EMPLOYER_ACCOUNT_VERIFICATION_LEVEL_STEPS = [
  'email_verified',
  'phone_and_business_doc_approved',
  'representative_verified',
]

const TOTAL_LEVELS = 3
const INVALIDATING_CASE_STATUSES = new Set([
  'changes_requested',
  'rejected',
  'revoked',
  'expired',
])

export function isEmployerVerificationInvalidated(verificationCase = {}) {
  return INVALIDATING_CASE_STATUSES.has(verificationCase.status)
}

export function getEmployerAccountVerificationLevel(
  verification = {},
  verificationCase = {},
  authoritative = undefined,
) {
  const authoritativeLevel = Number(
    typeof authoritative === 'object'
      ? authoritative?.level ?? authoritative?.account_level ?? authoritative?.employer_account_level
      : authoritative,
  )
  if (Number.isInteger(authoritativeLevel) && authoritativeLevel >= 0) {
    const level = Math.min(authoritativeLevel, TOTAL_LEVELS)
    return {
      level,
      total: TOTAL_LEVELS,
      percent: Math.round((level / TOTAL_LEVELS) * 100),
    }
  }

  const emailVerified = Boolean(verification.email_verified)
  const phoneVerified = Boolean(verification.phone_verified)
  const businessDocumentApproved = Boolean(
    verification.business_doc_approved
    && !isEmployerVerificationInvalidated(verificationCase),
  )
  const representativeApproved = verificationCase.status === 'approved'
    || Boolean(verification.representative_verified)

  let level = 0
  if (emailVerified) level = 1
  if (emailVerified && phoneVerified && businessDocumentApproved) level = 2
  // Report/domain/age govern the public trust badge, not the account level.
  // On compatibility payloads, representative_verified is the backend-derived
  // equivalent of an approved recruiter verification case.
  if (level === 2 && representativeApproved) level = 3

  return {
    level,
    total: TOTAL_LEVELS,
    percent: Math.round((level / TOTAL_LEVELS) * 100),
  }
}
