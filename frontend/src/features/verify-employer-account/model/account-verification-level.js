export const EMPLOYER_ACCOUNT_VERIFICATION_LEVEL_STEPS = [
  'phone_verified',
  'company_linked',
  'business_doc_submitted',
]

export function getEmployerAccountVerificationLevel(verification = {}) {
  const level = EMPLOYER_ACCOUNT_VERIFICATION_LEVEL_STEPS.filter((key) => verification[key]).length
  const total = EMPLOYER_ACCOUNT_VERIFICATION_LEVEL_STEPS.length
  return {
    level,
    total,
    percent: Math.round((level / total) * 100),
  }
}
