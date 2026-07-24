export const CAMPAIGN_STATUS_LABELS = {
  draft: 'Chưa khởi động',
  active: 'Đang mở',
  paused: 'Đang tắt',
  completed: 'Hoàn tất',
  cancelled: 'Đã hủy',
}

export const CAMPAIGN_STATUS_COLORS = {
  draft: 'default',
  active: 'green',
  paused: 'orange',
  completed: 'blue',
  cancelled: 'red',
}

export const CAMPAIGN_SCOPE_OPTIONS = [
  { value: '', label: 'Tất cả nhu cầu xử lý' },
  { value: 'needs_review', label: 'Có CV ứng tuyển mới cần xem' },
  { value: 'active_jobs', label: 'Có tin tuyển dụng đang tuyển' },
  { value: 'pending_jobs', label: 'Có tin tuyển dụng đang chờ duyệt' },
  { value: 'expired_jobs', label: 'Có tin tuyển dụng hết hạn' },
]

export const CAMPAIGN_STATUS_OPTIONS = [
  { value: '', label: 'Tất cả trạng thái' },
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
