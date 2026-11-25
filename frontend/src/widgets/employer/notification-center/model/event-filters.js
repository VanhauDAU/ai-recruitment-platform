import { m } from '@/shared/config/i18n'

// Event groups of the notification and history pages (`category` of the API).
// `countKey` reads `unread_counts` or `category_counts`; `icon` is a DuotoneIcon name.
export const EMPLOYER_EVENT_CATEGORIES = [
  { value: '', countKey: 'all', icon: 'squaresFour', label: m.employer_workspace_event_category_all() },
  { value: 'applications', countKey: 'applications', icon: 'usersThree', label: m.employer_workspace_event_category_applications() },
  { value: 'jobs', countKey: 'jobs', icon: 'briefcase', label: m.employer_workspace_event_category_jobs() },
  { value: 'campaigns', countKey: 'campaigns', icon: 'megaphone', label: m.employer_workspace_event_category_campaigns() },
  { value: 'company', countKey: 'company', icon: 'shieldCheck', label: m.employer_workspace_event_category_company() },
]

// `days` of the history API; '' keeps the whole 24-month retention.
export const EMPLOYER_ACTIVITY_PERIODS = [
  { value: '', label: m.employer_workspace_activity_period_all() },
  { value: '7', label: m.employer_workspace_activity_period_days({ days: 7 }) },
  { value: '30', label: m.employer_workspace_activity_period_days({ days: 30 }) },
  { value: '90', label: m.employer_workspace_activity_period_days({ days: 90 }) },
]

// The icon that says what happened; unlisted events use their group's icon.
export const EVENT_ICONS = {
  application_received: 'userPlus',
  application_withdrawn: 'userMinus',
  search_invitation_accepted: 'userCheck',
  search_invitation_declined: 'userCircleMinus',
  application_review_submitted: 'star',
  application_awaiting_reply: 'hourglassMedium',
  job_changes_requested: 'pencilSimpleLine',
  jobs_handed_over: 'arrowsLeftRight',
  campaign_activated: 'rocketLaunch',
  campaign_activation_failed: 'warningCircle',
  campaign_ending_soon: 'timer',
  campaign_auto_completed: 'flagCheckered',
  campaign_health_alert: 'heartbeat',
  social_post_failed: 'shareNetwork',
  social_post_delete_failed: 'trash',
  social_connection_expired: 'linkBreak',
  social_connection_expiring: 'linkBreak',
  verification_approved: 'sealCheck',
  verification_changes_requested: 'notePencil',
  verification_rejected: 'xCircle',
  verification_revoked: 'shieldSlash',
  verification_expired: 'calendarX',
  document_changes_requested: 'fileText',
  document_rejected: 'fileX',
  company_link_removed: 'linkBreak',
  company_page_editor_granted: 'userGear',
  company_page_editor_revoked: 'userMinus',
  company_content_reverted: 'arrowCounterClockwise',
  company_join_requested: 'userCirclePlus',
  company_join_approved: 'userCheck',
  company_join_rejected: 'userCircleMinus',
  company_ownership_changed: 'crown',
}
