export const JOB_REPORT_REASON_OPTIONS = [
  { value: 'fake_company', label: 'Công ty không có thật' },
  { value: 'scam', label: 'Lừa đảo, thu phí ứng viên' },
  { value: 'wrong_info', label: 'Thông tin tin đăng sai sự thật' },
  { value: 'duplicate', label: 'Tin trùng lặp' },
  { value: 'expired', label: 'Tin đã tuyển xong nhưng chưa gỡ' },
  { value: 'other', label: 'Lý do khác' },
]

export const JOB_REPORT_STATUS_OPTIONS = [
  { value: 'pending', label: 'Chờ xử lý' },
  { value: 'upheld', label: 'Đã xác nhận vi phạm' },
  { value: 'dismissed', label: 'Đã bác bỏ' },
]

export const JOB_REPORT_STATUS_LABELS = Object.fromEntries(
  JOB_REPORT_STATUS_OPTIONS.map(({ value, label }) => [value, label]),
)

export const JOB_REPORT_STATUS_COLORS = {
  pending: 'gold',
  upheld: 'red',
  dismissed: 'green',
}
