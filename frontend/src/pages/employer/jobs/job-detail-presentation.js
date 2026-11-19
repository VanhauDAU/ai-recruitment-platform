import dayjs from '@/shared/lib/dayjs'
import { APPLICATION_STATUS_TONES, RECRUITER_APPLICATION_STATUS_LABELS } from '@/entities/application/application'
import { jobDetailPath } from '@/entities/job/job'
import { MAIN_PORTAL_URL } from '@/shared/config/portals'

export const JOB_DETAIL_TABS = ['apply_cv', 'viewed_job', 'job', 'cv_label']

const EMPTY_SUMMARY = { total: 0, unviewed: 0, unanswered: 0, by_status: {} }

export function applicationSummary(job) {
  return job.application_summary || { ...EMPTY_SUMMARY, total: job.application_count || 0 }
}

/**
 * Filter chips of the CV tab; `applicationFilterParams` maps a chip key to
 * `scope` (derived bucket) or `status` of the recruiter applications API.
 * Statuses nobody is in stay hidden unless selected, so short pipelines do
 * not show a row of zeros.
 */
export function applicationFilterChips(summary, selected) {
  const chips = [
    { key: 'all', label: 'Tất cả', count: summary.total },
    { key: 'unanswered', label: 'Chưa phản hồi', count: summary.unanswered },
    ...Object.entries(RECRUITER_APPLICATION_STATUS_LABELS).map(([status, label]) => ({
      key: status,
      label,
      count: summary.by_status?.[status] || 0,
      // Tone names map onto `.job-tone-*` in employer-jobs.css.
      tone: APPLICATION_STATUS_TONES[status],
    })),
  ]
  return chips.filter((chip) => !chip.tone || chip.count > 0 || chip.key === selected)
}

export function applicationFilterParams(key) {
  if (!key || key === 'all') return {}
  if (key === 'unanswered') return { scope: 'unanswered' }
  return RECRUITER_APPLICATION_STATUS_LABELS[key] ? { status: key } : {}
}

/** "Hôm nay", "Hôm qua", "3 ngày trước", then the plain date after a week. */
export function formatRelativeDay(value, now = dayjs()) {
  const date = dayjs(value)
  if (!value || !date.isValid()) return '—'
  const days = now.startOf('day').diff(date.startOf('day'), 'day')
  if (days <= 0) return 'Hôm nay'
  if (days === 1) return 'Hôm qua'
  if (days < 7) return `${days} ngày trước`
  return date.format('DD/MM/YYYY')
}

/** Candidates can open the public page only while the job is live. */
export function publicJobUrl(job) {
  if (job.effective_state !== 'active' || !job.slug) return null
  return `${MAIN_PORTAL_URL.replace(/\/$/, '')}${jobDetailPath(job)}`
}

/**
 * Selectable window for extending or reopening a job. Extending cannot move
 * the deadline backwards and stays inside the public lifetime counted from
 * the first approval; both actions stop at the visibility end date.
 */
export function deadlineBounds(job, action, policy, today = dayjs().startOf('day')) {
  const maximumByToday = today.add(policy.max_deadline_days, 'day')
  const maximumByPublicLifetime = action === 'extend' && job.first_approved_at
    ? dayjs(job.first_approved_at).startOf('day').add(policy.max_public_lifetime_days, 'day')
    : maximumByToday
  const maximumByVisibility = job.visibility_ends_at
    ? dayjs(job.visibility_ends_at).startOf('day')
    : maximumByPublicLifetime
  const maximumByPolicy = maximumByPublicLifetime.isBefore(maximumByToday, 'day')
    ? maximumByPublicLifetime
    : maximumByToday
  return {
    earliest: action === 'extend' && job.deadline ? dayjs(job.deadline).startOf('day') : today,
    latest: maximumByVisibility.isBefore(maximumByPolicy, 'day') ? maximumByVisibility : maximumByPolicy,
  }
}
