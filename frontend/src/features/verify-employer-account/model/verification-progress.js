export const EMPLOYER_VERIFICATION_STEP_KEYS = [
  'phone_verified',
  'company_linked',
  'business_doc_submitted',
  'candidate_dpa_submitted',
  'dpa_accepted',
]

export function getEmployerVerificationProgress(verification = {}) {
  const completed = EMPLOYER_VERIFICATION_STEP_KEYS.filter((key) => verification[key]).length
  const total = EMPLOYER_VERIFICATION_STEP_KEYS.length
  return { completed, total, percent: Math.round((completed / total) * 100) }
}
