export const COMPANY_VERIFICATION = {
  unverified: { label: 'Chưa xác thực', color: 'default' },
  pending: { label: 'Chờ duyệt', color: 'gold' },
  verified: { label: 'Đã xác thực', color: 'green' },
  rejected: { label: 'Bị từ chối', color: 'red' },
}

export const RECRUITER_VERIFICATION = {
  none: { label: 'Chưa có hồ sơ', color: 'default' },
  draft: { label: 'Chưa nộp', color: 'default' },
  pending: { label: 'Chờ duyệt', color: 'gold' },
  in_review: { label: 'Đang xử lý', color: 'blue' },
  changes_requested: { label: 'Cần bổ sung', color: 'orange' },
  rejected: { label: 'Bị từ chối', color: 'red' },
  approved: { label: 'Đã xác thực', color: 'green' },
}

export function companyVerificationMeta(status) {
  return COMPANY_VERIFICATION[status] || { label: status || 'Không rõ', color: 'default' }
}

export function recruiterVerificationMeta(status) {
  return RECRUITER_VERIFICATION[status] || { label: status || 'Không rõ', color: 'default' }
}
