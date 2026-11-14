export const COMPANY_REPORT_REASON_OPTIONS = [
  { value: 'wrong_info', label: 'Thông tin công ty sai sự thật' },
  { value: 'impersonation', label: 'Mạo danh doanh nghiệp khác' },
  { value: 'inappropriate_content', label: 'Nội dung hoặc hình ảnh không phù hợp' },
  { value: 'scam', label: 'Dấu hiệu lừa đảo' },
  { value: 'other', label: 'Lý do khác' },
]

export const COMPANY_REPORT_STATUS_OPTIONS = [
  { value: 'pending', label: 'Chờ xử lý' },
  { value: 'upheld', label: 'Đã xác nhận vi phạm' },
  { value: 'dismissed', label: 'Đã bác bỏ' },
]

export const COMPANY_REPORT_STATUS_LABELS = Object.fromEntries(
  COMPANY_REPORT_STATUS_OPTIONS.map(({ value, label }) => [value, label]),
)

export const COMPANY_REPORT_STATUS_COLORS = {
  pending: 'gold',
  upheld: 'red',
  dismissed: 'green',
}
