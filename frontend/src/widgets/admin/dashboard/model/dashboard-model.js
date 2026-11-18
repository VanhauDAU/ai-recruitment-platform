import { adminPath } from '@/shared/config/portals'

export const DASHBOARD_LINKS = {
  activeJobs: adminPath('/job-moderation?job_scope=active'),
  heldJobs: adminPath('/job-moderation?job_scope=held'),
  restrictedCandidates: adminPath('/accounts?status=inactive,banned'),
  restrictedRecruiters: adminPath('/recruiters?status=inactive,banned'),
  knowledgeOverdue: adminPath('/knowledgebase?review_due=overdue'),
  recruiters: adminPath('/recruiters'),
  companies: adminPath('/companies'),
  candidates: adminPath('/accounts?tab=candidate'),
}

export const ACTIVITY_METRICS = [
  { key: 'applications', label: 'Lượt ứng tuyển', unit: 'lượt ứng tuyển' },
  { key: 'jobs', label: 'Tin đăng mới', unit: 'tin mới' },
  { key: 'candidates', label: 'Ứng viên mới', unit: 'ứng viên mới' },
  { key: 'employers', label: 'NTD mới', unit: 'NTD mới' },
]

const numberFormat = new Intl.NumberFormat('vi-VN')
const compactFormat = new Intl.NumberFormat('vi-VN', { notation: 'compact', maximumFractionDigits: 1 })
const percentFormat = new Intl.NumberFormat('vi-VN', { style: 'percent', maximumFractionDigits: 0 })
const timeFormat = new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' })
const dayFormat = new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: 'numeric', month: 'numeric', year: 'numeric' })

export const formatNumber = (value) => numberFormat.format(Number(value || 0))
export const formatCompact = (value) => compactFormat.format(Number(value || 0))
export const formatPercent = (value) => percentFormat.format(Number.isFinite(value) ? value : 0)
export const formatTime = (value) => timeFormat.format(new Date(value))
export const formatToday = (date = new Date()) => dayFormat.format(date)

export function ratio(part, whole) {
  return whole > 0 ? part / whole : 0
}

/** Relative change; `null` when there is no previous base to compare with. */
export function periodChange({ current = 0, previous = 0 } = {}) {
  if (!previous) return current ? null : 0
  return (current - previous) / previous
}

export function greeting(date = new Date()) {
  const hour = date.getHours()
  if (hour < 11) return 'Chào buổi sáng'
  if (hour < 14) return 'Chào buổi trưa'
  if (hour < 18) return 'Chào buổi chiều'
  return 'Chào buổi tối'
}
