export const CAMPAIGN_STATUS_LABELS = {
  draft: 'Chưa khởi động',
  active: 'Đang mở',
  paused: 'Đã dừng',
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
  { value: '', label: 'Tất cả chiến dịch' },
  { value: 'open', label: 'Chỉ chiến dịch đang mở' },
  { value: 'needs_review', label: 'Có CV ứng tuyển mới cần xem' },
  { value: 'active_jobs', label: 'Có tin tuyển dụng đang hiển thị' },
  { value: 'pending_jobs', label: 'Có tin tuyển dụng đang chờ duyệt' },
  { value: 'expired_jobs', label: 'Có tin tuyển dụng hết hạn' },
]

export const POSITION_LEVEL_OPTIONS = [
  ['employee', 'Nhân viên'], ['team_lead', 'Trưởng nhóm'], ['manager', 'Trưởng / Phó phòng'],
  ['supervisor', 'Quản lý / Giám sát'], ['branch_manager', 'Trưởng chi nhánh'],
  ['vice_director', 'Phó giám đốc'], ['director', 'Giám đốc'], ['intern', 'Thực tập sinh'],
]

export const BUDGET_SOURCE_OPTIONS = [['company', 'Công ty'], ['personal', 'Cá nhân']]

function numeric(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function calculateCampaignOptimizationScore(campaign, report) {
  if (campaign?.optimization_score != null) return numeric(campaign.optimization_score)
  const checks = [
    Boolean(campaign?.name?.trim()),
    Boolean(campaign?.status),
    numeric(campaign?.job_count ?? report?.jobs?.total) > 0,
    numeric(report?.headcount_target) > 0,
  ]
  return Math.round((checks.filter(Boolean).length / checks.length) * 100)
}
