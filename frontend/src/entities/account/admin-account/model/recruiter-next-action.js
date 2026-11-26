import { adminPath } from '@/shared/config/portals'
import { m } from '@/shared/config/i18n'

/**
 * Presentation of the backend `context.next_action.code` (one rule, computed
 * in SQL so the list can filter, count and sort by it). `owner: 'admin'`
 * means the admin has to act; the rest wait on the recruiter.
 */
const NEXT_ACTIONS = {
  verification_overdue: {
    label: m.admin_next_overdue(),
    tone: 'critical',
    owner: 'admin',
    cta: { label: m.admin_next_cta_verify(), tab: 'verification' },
  },
  verification_review: {
    label: m.admin_next_review(),
    tone: 'warning',
    owner: 'admin',
    cta: { label: m.admin_next_cta_verify(), tab: 'verification' },
  },
  company_update_review: {
    label: m.admin_next_company_update(),
    tone: 'warning',
    owner: 'admin',
    cta: { label: m.admin_next_cta_company_update(), tab: 'verification' },
  },
  account_restricted: {
    label: m.admin_next_restricted(),
    tone: 'info',
    owner: 'admin',
    cta: { label: m.admin_next_cta_restricted(), tab: 'security' },
  },
  awaiting_resubmission: { label: m.admin_next_awaiting_resubmission(), tone: 'muted', owner: 'recruiter' },
  awaiting_company: { label: m.admin_next_awaiting_company(), tone: 'muted', owner: 'recruiter' },
  awaiting_onboarding: { label: m.admin_next_awaiting_onboarding(), tone: 'muted', owner: 'recruiter' },
  awaiting_submission: { label: m.admin_next_awaiting_submission(), tone: 'muted', owner: 'recruiter' },
  none: { label: m.admin_next_none(), tone: 'none', owner: 'none' },
}

export function recruiterNextAction(account) {
  const nextAction = account?.context?.next_action
  const meta = NEXT_ACTIONS[nextAction?.code]
  if (!meta) return null
  const cta = meta.cta && {
    ...meta.cta,
    params: nextAction.company_update_public_id && nextAction.code === 'company_update_review'
      ? { company_update: nextAction.company_update_public_id }
      : {},
  }
  return { code: nextAction.code, ...meta, cta }
}

/** Detail-page URL for the action's CTA (tab + extra params). */
export function recruiterActionHref(publicId, cta) {
  const params = new URLSearchParams({ ...(cta?.tab && cta.tab !== 'overview' ? { tab: cta.tab } : {}), ...cta?.params })
  const query = params.toString()
  return `${adminPath(`/nha-tuyen-dung/${publicId}`)}${query ? `?${query}` : ''}`
}
