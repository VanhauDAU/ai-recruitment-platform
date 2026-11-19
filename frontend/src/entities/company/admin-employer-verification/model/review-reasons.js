/**
 * Quick-pick reasons for verification, company-update and domain decisions.
 * They only pre-fill the reason field; the admin can always edit the text.
 */
export const DOCUMENT_REVIEW_REASONS = {
  changes_requested: [
    'Ảnh mờ hoặc bị cắt, cần chụp lại',
    'Giấy tờ đã hết hiệu lực',
    'Thông tin không khớp mã số thuế hoặc tên công ty',
    'Thiếu trang hoặc thiếu dấu xác nhận',
  ],
  rejected: [
    'Sai loại giấy tờ yêu cầu',
    'Giấy tờ có dấu hiệu chỉnh sửa hoặc giả mạo',
  ],
}

export const CASE_DECISION_REASONS = {
  approved: ['Đã đối chiếu đủ giấy tờ và thông tin doanh nghiệp'],
  changes_requested: [
    'Cần bổ sung giấy tờ còn thiếu',
    'Thông tin trên giấy tờ không khớp hồ sơ công ty',
    'Thiếu giấy ủy quyền hợp lệ',
  ],
  rejected: [
    'Người nộp không phải đại diện hợp lệ của doanh nghiệp',
    'Doanh nghiệp đã ngừng hoạt động theo tra cứu thuế',
    'Giấy tờ có dấu hiệu giả mạo',
  ],
  revoked: ['Doanh nghiệp yêu cầu thu hồi', 'Phát hiện giấy tờ không còn hợp lệ'],
  expired: ['Giấy ủy quyền đã hết hạn'],
  unlock: ['Khiếu nại của nhà tuyển dụng đã được chấp nhận'],
}

export const COMPANY_UPDATE_REASONS = {
  approved: ['Đã đối chiếu thay đổi với giấy tờ'],
  changes_requested: [
    'Thiếu giấy tờ chứng minh thay đổi',
    'Thông tin mới không khớp giấy tờ',
  ],
  rejected: ['Thay đổi không có căn cứ pháp lý'],
}

export const DOMAIN_REVIEW_REASONS = {
  approve_manual: ['Đã đối chiếu tên miền với giấy tờ doanh nghiệp'],
  reject_manual: ['Tên miền không thuộc doanh nghiệp', 'Chưa đủ bằng chứng sở hữu tên miền'],
  revoke: ['Doanh nghiệp không còn sử dụng tên miền'],
}
