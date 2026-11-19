import { adminPath } from '@/shared/config/portals'

/**
 * Presentation of the backend `context.next_action.code` (one rule, computed
 * in SQL so the list can filter, count and sort by it). `owner: 'admin'`
 * means the admin has to act; the rest wait on the recruiter.
 */
const NEXT_ACTIONS = {
  verification_overdue: {
    label: 'Hồ sơ quá hạn 72 giờ',
    tone: 'critical',
    owner: 'admin',
    cta: { label: 'Duyệt xác thực', tab: 'verification' },
  },
  verification_review: {
    label: 'Hồ sơ xác thực chờ duyệt',
    tone: 'warning',
    owner: 'admin',
    cta: { label: 'Duyệt xác thực', tab: 'verification' },
  },
  company_update_review: {
    label: 'Cập nhật công ty chờ duyệt',
    tone: 'warning',
    owner: 'admin',
    cta: { label: 'Duyệt cập nhật', tab: 'verification' },
  },
  account_restricted: {
    label: 'Tài khoản đang bị hạn chế',
    tone: 'info',
    owner: 'admin',
    cta: { label: 'Xem hạn chế', tab: 'security' },
  },
  awaiting_resubmission: { label: 'Chờ NTD bổ sung hồ sơ', tone: 'muted', owner: 'recruiter' },
  awaiting_company: { label: 'Chưa liên kết công ty', tone: 'muted', owner: 'recruiter' },
  awaiting_onboarding: { label: 'Chưa hoàn tất thiết lập', tone: 'muted', owner: 'recruiter' },
  awaiting_submission: { label: 'Chưa nộp hồ sơ xác thực', tone: 'muted', owner: 'recruiter' },
  none: { label: 'Không có việc cần làm', tone: 'none', owner: 'none' },
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
  return `${adminPath(`/recruiters/${publicId}`)}${query ? `?${query}` : ''}`
}
