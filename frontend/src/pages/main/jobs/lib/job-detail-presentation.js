import { getIntlLocale, m } from '@/shared/config/i18n'

export function formatJobDate(value) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString(getIntlLocale())
}

/** A stopped job stays readable but no longer takes applications. */
export function isAcceptingApplications(job) {
  return job?.accepting_applications !== false
}

// Số liệu thật sau Huy hiệu Sấm Chớp của người đăng tin (ADR-0027).
export function formatFlashBadgeStats(stats) {
  if (!stats) return ''
  const rate = stats.response_rate
  const hours = stats.avg_response_hours
  if (hours == null) return m.candidate_job_flash_stats({ rate })
  if (hours < 24) return m.candidate_job_flash_stats_hours({ rate, hours: Math.max(1, Math.round(hours)) })
  const days = (hours / 24).toLocaleString(getIntlLocale(), { maximumFractionDigits: 1 })
  return m.candidate_job_flash_stats_days({ rate, days })
}
