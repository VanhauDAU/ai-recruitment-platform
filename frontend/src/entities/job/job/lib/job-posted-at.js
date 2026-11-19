import { m } from '@/shared/config/i18n'

const DAY_IN_MS = 86_400_000

export function getJobPostedAt(job = {}) {
  return job.first_approved_at || job.published_at || job.created_at || null
}

export function formatJobPostedLabel(job, now = Date.now()) {
  const postedAt = getJobPostedAt(job)
  if (!postedAt) return null

  const postedTimestamp = new Date(postedAt).getTime()
  if (Number.isNaN(postedTimestamp)) return null

  const days = Math.floor((now - postedTimestamp) / DAY_IN_MS)
  if (days <= 0) return m.job_posted_today()
  if (days < 7) return m.job_posted_days_ago({ count: days })
  if (days < 30) return m.job_posted_weeks_ago({ count: Math.floor(days / 7) })
  return m.job_posted_months_ago({ count: Math.floor(days / 30) })
}
