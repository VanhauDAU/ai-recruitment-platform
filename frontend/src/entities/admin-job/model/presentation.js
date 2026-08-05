export const ADMIN_JOB_STATUS = {
  draft: { label: 'Nháp', color: 'default' },
  pending: { label: 'Chờ duyệt', color: 'gold' },
  active: { label: 'Đang tuyển', color: 'green' },
  closed: { label: 'Đã đóng', color: 'default' },
  rejected: { label: 'Từ chối', color: 'red' },
}

export const JOB_SCOPE_OPTIONS = [
  { value: 'pending', label: 'Chờ duyệt' },
  { value: 'all', label: 'Tất cả tin' },
  { value: 'active', label: 'Đang tuyển' },
  { value: 'expired', label: 'Quá hạn' },
  { value: 'held', label: 'Đang tạm giữ' },
  { value: 'rejected', label: 'Từ chối' },
  { value: 'closed', label: 'Đã đóng' },
  { value: 'draft', label: 'Nháp' },
]

export const JOB_DECISION_REASONS = [
  { value: 'incomplete_content', label: 'Nội dung chưa đầy đủ' },
  { value: 'misleading_content', label: 'Nội dung gây hiểu nhầm' },
  { value: 'prohibited_content', label: 'Nội dung bị cấm' },
  { value: 'fraud_risk', label: 'Có dấu hiệu lừa đảo' },
  { value: 'duplicate_posting', label: 'Tin trùng lặp' },
  { value: 'confirmed_report', label: 'Báo cáo vi phạm đã xác nhận' },
  { value: 'other', label: 'Lý do khác' },
]

export function adminJobStatusMeta(job) {
  return ADMIN_JOB_STATUS[job?.status] || {
    label: job?.status_label || job?.status || 'Không xác định',
    color: 'default',
  }
}

export function formatAdminJobDateTime(value) {
  return value ? new Date(value).toLocaleString('vi-VN') : '—'
}

export function formatAdminJobDate(value) {
  return value ? new Date(`${value}T00:00:00`).toLocaleDateString('vi-VN') : '—'
}
