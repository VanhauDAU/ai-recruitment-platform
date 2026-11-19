import dayjs from 'dayjs'
import { employerAppPath } from '@/shared/config/portals'

// `countKey` reads `status_counts` of GET /api/employer/jobs/, which counts every
// tab under the current search so the numbers never depend on the open tab.
export const JOB_STATUS_TABS = [
  { value: '', label: 'Tất cả', countKey: 'all' },
  { value: 'active', label: 'Đang tuyển', countKey: 'active' },
  { value: 'hidden', label: 'Bị ẩn', countKey: 'hidden' },
  { value: 'draft', label: 'Nháp', countKey: 'draft' },
  { value: 'expired', label: 'Hết hạn', countKey: 'expired' },
  { value: 'closed', label: 'Ngừng tuyển', countKey: 'closed' },
]

// Keys are the backend `effective_state`: what candidates experience now.
const STATUS_META = {
  active: { label: 'Đang tuyển', tone: 'emerald' },
  hidden: { label: 'Bị ẩn', tone: 'red' },
  draft: { label: 'Nháp', tone: 'slate' },
  expired: { label: 'Hết hạn', tone: 'orange' },
  closed: { label: 'Ngừng tuyển', tone: 'slate' },
}

// An administrator or account hold, the only hide that also freezes editing.
export function isJobHeld(job) {
  return Boolean(job.visibility_hold)
}

// Changes were requested on a fixable reason: the owner edits, then resubmits.
export function isJobEditableUnderHold(job) {
  return Boolean(job.visibility_hold?.editable)
}

export function jobStatusMeta(job) {
  return STATUS_META[job.effective_state] || { label: job.status || 'Không xác định', tone: 'slate' }
}

export function jobDisplayTitle(job) {
  if (job.title) return job.title
  return job.status === 'draft' ? 'Tin nháp chưa đặt tên' : 'Tin tuyển dụng chưa đặt tên'
}

export function formatJobDate(value) {
  if (!value) return '—'
  const date = dayjs(value)
  return date.isValid() ? date.format('DD/MM/YYYY') : '—'
}

const DEADLINE_TONES = {
  success: { text: 'text-emerald-700', bar: 'bg-emerald-500' },
  warning: { text: 'text-amber-700', bar: 'bg-amber-500' },
  danger: { text: 'text-red-600', bar: 'bg-red-500' },
  expired: { text: 'text-orange-700', bar: 'bg-orange-500' },
  muted: { text: 'text-slate-400', bar: 'bg-slate-300' },
}

/**
 * Deadline cell of a job: the date, a short countdown and how much of the
 * posting window has elapsed (only for jobs candidates can still apply to).
 */
export function jobDeadlineMeta(job, now = dayjs()) {
  const date = job.deadline ? formatJobDate(job.deadline) : null
  const build = (hint, tone, progress = null) => ({ date, hint, progress, tone: DEADLINE_TONES[tone] })
  if (job.status === 'draft') return build('Chưa đăng tin', 'muted')
  if (job.status === 'closed') return build('Đã ngừng tuyển', 'muted')
  if (job.is_expired) return build('Đã hết hạn', 'expired')
  if (!job.deadline) return build('Không giới hạn', 'success')

  const today = now.startOf('day')
  const deadline = dayjs(job.deadline).startOf('day')
  const daysLeft = deadline.diff(today, 'day')
  const postedAt = dayjs(job.first_approved_at || job.published_at || job.created_at).startOf('day')
  const window = deadline.diff(postedAt, 'day')
  const progress = window > 0
    ? Math.min(100, Math.max(0, Math.round((today.diff(postedAt, 'day') / window) * 100)))
    : null
  const tone = daysLeft <= 3 ? 'danger' : daysLeft <= 7 ? 'warning' : 'success'
  return build(daysLeft <= 0 ? 'Hết hạn hôm nay' : `Còn ${daysLeft} ngày`, tone, progress)
}

const percentFormat = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 })

/** Share of views that ended in an application, e.g. "2,5%"; null without views. */
export function formatApplyRate(applications, views) {
  if (!views || !applications) return null
  return `${percentFormat.format(Math.min(applications / views, 1) * 100)}%`
}

export function formatCount(value) {
  return (value || 0).toLocaleString('vi-VN')
}

export function candidateInitials(name) {
  const words = (name || '').trim().split(/\s+/).filter(Boolean)
  return words.slice(-2).map((word) => word.charAt(0)).join('').toUpperCase() || 'UV'
}

/** Deep link into the CV workspace, optionally on one application or scope. */
export function employerJobApplicationsPath(job, { applicationId, scope } = {}) {
  const params = new URLSearchParams({ job: job.public_id })
  if (scope) params.set('scope', scope)
  if (applicationId) params.set('application', applicationId)
  return employerAppPath(`/applications?${params}`)
}
