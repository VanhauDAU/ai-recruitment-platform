import { m } from '@/shared/config/i18n'

// Event groups of the notification and history pages (`category` of the API);
// `countKey` reads `unread_counts` or `category_counts`.
export const EMPLOYER_EVENT_CATEGORIES = [
  { value: '', countKey: 'all', label: m.employer_workspace_event_category_all() },
  { value: 'applications', countKey: 'applications', label: m.employer_workspace_event_category_applications() },
  { value: 'jobs', countKey: 'jobs', label: m.employer_workspace_event_category_jobs() },
  { value: 'campaigns', countKey: 'campaigns', label: m.employer_workspace_event_category_campaigns() },
  { value: 'company', countKey: 'company', label: m.employer_workspace_event_category_company() },
]

// `days` of the history API; '' keeps the whole 24-month retention.
export const EMPLOYER_ACTIVITY_PERIODS = [
  { value: '', label: m.employer_workspace_activity_period_all() },
  { value: '7', label: m.employer_workspace_activity_period_days({ days: 7 }) },
  { value: '30', label: m.employer_workspace_activity_period_days({ days: 30 }) },
  { value: '90', label: m.employer_workspace_activity_period_days({ days: 90 }) },
]
