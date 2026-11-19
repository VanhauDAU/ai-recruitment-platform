import { getIntlLocale } from '@/shared/config/i18n'
export function formatJobDate(value) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString(getIntlLocale())
}

/** A stopped job stays readable but no longer takes applications. */
export function isAcceptingApplications(job) {
  return job?.accepting_applications !== false
}
