export const EMPLOYER_VERIFICATION_STATUS = {
  draft: { label: 'Chưa nộp', color: 'default' },
  pending: { label: 'Chờ duyệt', color: 'gold' },
  in_review: { label: 'Đang xử lý', color: 'blue' },
  changes_requested: { label: 'Cần bổ sung', color: 'orange' },
  rejected: { label: 'Bị từ chối', color: 'red' },
  approved: { label: 'Đã xác thực', color: 'green' },
  revoked: { label: 'Đã thu hồi', color: 'red' },
  expired: { label: 'Hết hiệu lực', color: 'volcano' },
}

export const DOCUMENT_STATUS = {
  pending: { label: 'Chờ duyệt', color: 'gold' },
  changes_requested: { label: 'Cần bổ sung', color: 'orange' },
  rejected: { label: 'Bị từ chối', color: 'red' },
  approved: { label: 'Đã duyệt', color: 'green' },
}

export const VERIFICATION_CHECK_LABELS = {
  email_verified: 'Email đã xác minh',
  registration_completed: 'Đăng ký hồ sơ NTD hoàn tất',
  consulting_need_completed: 'Đã khai báo nhu cầu tuyển dụng',
  phone_verified: 'Số điện thoại đã xác minh',
  company_linked: 'Đã liên kết công ty',
  representative_documents_submitted: 'Đã nộp giấy tờ đại diện',
  business_documents_approved: 'Giấy tờ doanh nghiệp đã được duyệt',
  candidate_dpa_approved: 'Văn bản xử lý dữ liệu đã được duyệt',
  dpa_accepted: 'Đã chấp nhận DPA nền tảng',
}

export function verificationStatusMeta(status) {
  return EMPLOYER_VERIFICATION_STATUS[status] || {
    label: status || 'Chưa xác định',
    color: 'default',
  }
}

export function documentStatusMeta(status) {
  return DOCUMENT_STATUS[status] || {
    label: status || 'Chưa xác định',
    color: 'default',
  }
}
