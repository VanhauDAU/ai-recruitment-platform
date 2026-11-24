import dayjs from '@/shared/lib/dayjs'
import { employerAppPath } from '@/shared/config/portals'
import { m, getIntlLocale } from '@/shared/config/i18n'

// `countKey` reads `status_counts` of GET /api/employer/jobs/, which counts every
// tab under the current search so the numbers never depend on the open tab.
export const JOB_STATUS_TABS = [
  { value: '', label: m.employer_job_status_all(), countKey: 'all' },
  { value: 'active', label: m.employer_job_status_active(), countKey: 'active' },
  { value: 'hidden', label: m.employer_job_status_hidden(), countKey: 'hidden' },
  { value: 'draft', label: m.employer_job_status_draft(), countKey: 'draft' },
  { value: 'expired', label: m.employer_job_status_expired(), countKey: 'expired' },
  { value: 'closed', label: m.employer_job_status_closed(), countKey: 'closed' },
]

// `ordering` of GET /api/employer/jobs/; '' is the backend default (-created).
export const JOB_SORT_OPTIONS = [
  { value: '', label: m.employer_job_list_sort_newest() },
  { value: '-updated', label: m.employer_job_list_sort_updated() },
  { value: 'deadline', label: m.employer_job_list_sort_deadline() },
  { value: '-unviewed', label: m.employer_job_list_sort_unviewed() },
  { value: '-candidates', label: m.employer_job_list_sort_candidates() },
  { value: '-views', label: m.employer_job_list_sort_views() },
]

// Sortable column headers: a click sorts by the column, a second click resets.
export const JOB_SORT_COLUMNS = {
  candidates: '-candidates',
  views: '-views',
  deadline: 'deadline',
}

// `attention` filters; counts come from `attention_counts` inside the open tab.
export const JOB_ATTENTION_FILTERS = [
  { value: 'unviewed', label: m.employer_job_list_attention_unviewed(), tone: 'orange' },
  { value: 'expiring', label: m.employer_job_list_attention_expiring(), hint: m.employer_job_list_attention_expiring_hint(), tone: 'amber' },
]

// Keys are the backend `effective_state`: what candidates experience now.
const STATUS_META = {
  active: { label: m.employer_job_status_active(), tone: 'emerald' },
  hidden: { label: m.employer_job_status_hidden(), tone: 'red' },
  draft: { label: m.employer_job_status_draft(), tone: 'slate' },
  expired: { label: m.employer_job_status_expired(), tone: 'orange' },
  closed: { label: m.employer_job_status_closed(), tone: 'slate' },
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
  return STATUS_META[job.effective_state] || { label: job.status || m.employer_job_status_unknown(), tone: 'slate' }
}

export function jobDisplayTitle(job) {
  if (job.title) return job.title
  return job.status === 'draft' ? m.employer_job_list_untitled_draft() : m.employer_job_list_untitled_job()
}

export function formatJobDate(value) {
  if (!value) return '—'
  const date = dayjs(value)
  return date.isValid() ? date.format('DD/MM/YYYY') : '—'
}

const DEADLINE_TONES = {
  success: { text: 'text-slate-500', bar: 'bg-slate-400' },
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
  // `closes_on` is the earlier of the deadline and the end of the display window.
  const closesOn = job.closes_on || job.deadline
  const date = closesOn ? formatJobDate(closesOn) : null
  const windowEnds = Boolean(job.closes_on && job.closes_on !== job.deadline)
  const build = (hint, tone, progress = null) => ({ date, hint, progress, windowEnds, tone: DEADLINE_TONES[tone] })
  if (job.status === 'draft') return build(m.employer_job_list_deadline_not_posted(), 'muted')
  if (job.status === 'closed') return build(m.employer_job_list_deadline_closed(), 'muted')
  if (job.is_expired) return build(m.employer_job_list_deadline_expired(), 'expired')
  if (!closesOn) return build(m.employer_job_list_deadline_unlimited(), 'success')

  const today = now.startOf('day')
  const deadline = dayjs(closesOn).startOf('day')
  const daysLeft = deadline.diff(today, 'day')
  const postedAt = dayjs(job.first_approved_at || job.published_at || job.created_at).startOf('day')
  const window = deadline.diff(postedAt, 'day')
  const progress = window > 0
    ? Math.min(100, Math.max(0, Math.round((today.diff(postedAt, 'day') / window) * 100)))
    : null
  const tone = daysLeft <= 3 ? 'danger' : daysLeft <= 7 ? 'warning' : 'success'
  return build(daysLeft <= 0 ? m.employer_job_list_deadline_today() : m.employer_job_list_deadline_days_left({ days: daysLeft }), tone, progress)
}

const percentFormat = new Intl.NumberFormat(getIntlLocale(), { maximumFractionDigits: 1 })

/** Share of views that ended in an application, e.g. "2,5%"; null without views. */
export function formatApplyRate(applications, views) {
  if (!views || !applications) return null
  return `${percentFormat.format(Math.min(applications / views, 1) * 100)}%`
}

export function formatCount(value) {
  return (value || 0).toLocaleString(getIntlLocale())
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
