export const CAMPAIGN_STATUS_LABELS = {
  draft: 'Nháp',
  scheduled: 'Đã lên lịch',
  active: 'Đang mở',
  paused: 'Đang tắt',
  completed: 'Hoàn tất',
  cancelled: 'Đã hủy',
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
  { value: '', label: 'Tất cả nhu cầu xử lý' },
  { value: 'needs_review', label: 'Có CV ứng tuyển mới cần xem' },
  { value: 'active_jobs', label: 'Có tin tuyển dụng đang tuyển' },
  { value: 'expired_jobs', label: 'Có tin tuyển dụng hết hạn' },
]

export const CAMPAIGN_STATUS_OPTIONS = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'draft', label: 'Nháp' },
  { value: 'scheduled', label: 'Đã lên lịch' },
  { value: 'active', label: 'Đang hoạt động' },
  { value: 'paused', label: 'Đang tắt' },
  { value: 'completed', label: 'Hoàn tất' },
]

export const CAMPAIGN_ORDERING_OPTIONS = [
  { value: 'activity', label: 'Hoạt động gần nhất' },
  { value: 'newest', label: 'Mới tạo gần đây' },
  { value: 'oldest', label: 'Cũ nhất' },
  { value: 'name', label: 'Tên A–Z' },
]

// Chiến dịch còn ở bước thiết lập: chỉnh mục tiêu, chọn tin rồi kích hoạt.
export const CAMPAIGN_SETUP_STATUSES = ['draft', 'scheduled']

export const CAMPAIGN_BUDGET_SOURCE_OPTIONS = [
  { value: 'company', label: 'Công ty chi trả' },
  { value: 'personal', label: 'Cá nhân chi trả' },
]
