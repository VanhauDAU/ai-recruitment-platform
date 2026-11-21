import { m } from '@/shared/config/i18n'

export const CAMPAIGN_STATUS_LABELS = {
  draft: m.campaign_status_draft(),
  scheduled: m.campaign_status_scheduled(),
  active: m.campaign_status_active(),
  paused: m.campaign_status_paused(),
  completed: m.campaign_status_completed(),
  cancelled: m.campaign_status_cancelled(),
}

export const CAMPAIGN_STATUS_COLORS = {
  draft: 'default',
  scheduled: 'cyan',
  active: 'green',
  paused: 'orange',
  completed: 'blue',
  cancelled: 'red',
}

export const CAMPAIGN_SCOPE_OPTIONS = [
  { value: '', label: m.campaign_scope_all() },
  { value: 'needs_review', label: m.campaign_scope_needs_review() },
  { value: 'active_jobs', label: m.campaign_scope_active_jobs() },
  { value: 'expired_jobs', label: m.campaign_scope_expired_jobs() },
]

// Dải lọc trạng thái của danh sách; ``ended`` gộp hoàn tất và đã hủy.
export const CAMPAIGN_STATUS_TABS = [
  { value: '', label: m.campaign_status_all(), countKey: 'all' },
  { value: 'active', label: m.campaign_status_active(), countKey: 'active' },
  { value: 'paused', label: m.campaign_status_paused(), countKey: 'paused' },
  { value: 'scheduled', label: m.campaign_status_scheduled(), countKey: 'scheduled' },
  { value: 'draft', label: m.campaign_status_draft(), countKey: 'draft' },
  { value: 'ended', label: m.campaign_status_ended(), countKey: 'ended' },
]

export const CAMPAIGN_ORDERING_OPTIONS = [
  { value: 'status', label: m.campaign_ordering_status() },
  { value: 'activity', label: m.campaign_ordering_activity() },
  { value: 'newest', label: m.campaign_ordering_newest() },
  { value: 'oldest', label: m.campaign_ordering_oldest() },
  { value: 'name', label: m.campaign_ordering_name() },
]

// Chiến dịch còn ở bước thiết lập: chỉnh mục tiêu, chọn tin rồi kích hoạt.
export const CAMPAIGN_SETUP_STATUSES = ['draft', 'scheduled']

export const CAMPAIGN_BUDGET_SOURCE_OPTIONS = [
  { value: 'company', label: m.campaign_budget_company() },
  { value: 'personal', label: m.campaign_budget_personal() },
]

export const CAMPAIGN_CHANNEL_KINDS = [
  { value: 'facebook_page', label: m.campaign_channel_facebook_page() },
  { value: 'facebook_group', label: m.campaign_channel_facebook_group() },
  { value: 'instagram', label: 'Instagram' },
  { value: 'threads', label: 'Threads' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'zalo', label: 'Zalo' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'email', label: 'Email' },
  { value: 'website', label: m.campaign_channel_website() },
  { value: 'qr_offline', label: m.campaign_channel_qr_offline() },
  { value: 'other', label: m.campaign_channel_other() },
]
