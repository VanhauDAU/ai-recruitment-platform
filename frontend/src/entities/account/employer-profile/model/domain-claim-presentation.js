import { getIntlLocale, m } from '@/shared/config/i18n'

const STATUS_PRESENTATION = {
  pending: { color: 'processing', label: m.employer_profile_domain_dns_pending() },
  dns_pending: { color: 'processing', label: m.employer_profile_domain_dns_pending() },
  manual_review: { color: 'warning', label: m.employer_profile_domain_manual_review() },
  pending_manual_review: { color: 'warning', label: m.employer_profile_domain_manual_review() },
  verified: { color: 'success', label: m.employer_profile_domain_verified() },
  grace: { color: 'warning', label: m.employer_profile_domain_grace() },
  grace_period: { color: 'warning', label: m.employer_profile_domain_grace() },
  revoked: { color: 'error', label: m.employer_profile_domain_revoked() },
  expired: { color: 'default', label: m.employer_profile_domain_expired() },
  rejected: { color: 'error', label: m.employer_profile_domain_rejected() },
  legacy_inferred: { color: 'warning', label: m.employer_profile_domain_reverify() },
}

export function domainClaimStatusPresentation(value) {
  const claim = typeof value === 'object' ? value : null
  const status = claim?.status || value
  if (claim?.method === 'admin_manual' && status === 'pending') {
    return { color: 'warning', label: m.employer_profile_domain_manual_review() }
  }
  return STATUS_PRESENTATION[status] || { color: 'default', label: status || m.employer_profile_domain_unverified() }
}

export function domainClaimAllows(claim, action) {
  const allowed = Array.isArray(claim?.allowed_actions) ? claim.allowed_actions : []
  const aliases = new Set([
    action,
    action.replaceAll('_', '-'),
    action.replaceAll('-', '_'),
  ])
  return allowed.some((item) => aliases.has(item))
}

export function formatDomainClaimDate(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString(getIntlLocale(), { dateStyle: 'short', timeStyle: 'short' })
}
