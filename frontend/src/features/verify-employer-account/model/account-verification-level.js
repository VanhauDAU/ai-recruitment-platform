export const EMPLOYER_ACCOUNT_VERIFICATION_LEVEL_STEPS = [
  'phone_verified',
  'company_linked',
  'business_doc_approved',
]

const TOTAL_LEVELS = 3
const PUBLIC_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'yahoo.com.vn',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'msn.com',
  'icloud.com',
  'me.com',
  'proton.me',
  'protonmail.com',
  'zoho.com',
  'mail.com',
  'example.com',
  'example.org',
  'example.net',
])

function isCompanyEmail(email) {
  const domain = (email || '').split('@').pop()?.trim().toLowerCase() || ''
  return Boolean(domain && domain.includes('.') && !PUBLIC_EMAIL_DOMAINS.has(domain))
}

export function getEmployerAccountVerificationLevel(verification = {}, user = {}) {
  const emailVerified = Boolean(verification.email_verified ?? user?.email_verified)
  const phoneVerified = Boolean(verification.phone_verified)
  const businessDocumentApproved = Boolean(verification.business_doc_approved)
  const companyEmail = verification.email_domain_verified ?? isCompanyEmail(user?.email)
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
