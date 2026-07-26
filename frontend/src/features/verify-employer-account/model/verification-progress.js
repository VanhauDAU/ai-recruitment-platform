export const EMPLOYER_VERIFICATION_STEP_KEYS = [
  'email_verified',
  'registration_completed',
  'consulting_need_completed',
  'phone_verified',
  'company_linked',
  'business_doc_submitted',
  'business_doc_approved',
  'candidate_dpa_approved',
  'dpa_accepted',
  'representative_verified',
]

export function getEmployerVerificationProgress(verification = {}) {
  const completed = EMPLOYER_VERIFICATION_STEP_KEYS.filter((key) => verification[key]).length
  const total = EMPLOYER_VERIFICATION_STEP_KEYS.length
  return { completed, total, percent: Math.round((completed / total) * 100) }
}
