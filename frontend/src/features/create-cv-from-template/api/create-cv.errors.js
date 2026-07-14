// Maps a failed createCvFromTemplate() call to a specific, user-facing Vietnamese
// message. The backend answers with distinct shapes per failure, so a single
// generic string ("thử lại") hides the real cause from the candidate.
//
// Sources (apps/cvs): CvV2CreateSerializer field errors (400), IsCandidate (401/403),
// create_v2_cv -> CvLifecyclePolicyError for email/template (403), 5xx for
// server/database faults, and no `response` at all when the backend is unreachable.

// Known English backend phrases -> Vietnamese, matched case-insensitively on a
// substring so minor wording changes still map.
const KNOWN_PHRASES = [
  [/verify your email/i, 'Bạn cần xác thực email trước khi tạo CV.'],
  [/does not have a published version|not published/i, 'Mẫu CV này chưa được xuất bản. Hãy chọn mẫu khác.'],
  [/unknown template/i, 'Mẫu CV không tồn tại hoặc đã bị gỡ. Hãy chọn lại mẫu.'],
  [/unknown sample content/i, 'Nội dung mẫu không tồn tại. Hãy chọn nội dung mẫu khác.'],
  [/unknown active specialization/i, 'Vị trí chuyên môn không tồn tại hoặc đã ngừng hoạt động.'],
  [/chưa được cấu hình nội dung|chưa có blueprint/i, 'Vị trí chưa có nội dung cho ngôn ngữ đã chọn.'],
  [/sample locale must match/i, 'Nội dung mẫu không cùng ngôn ngữ với CV. Hãy chọn nội dung mẫu phù hợp.'],
]

function flattenDetail(data) {
  if (!data) return ''
  if (typeof data === 'string') return data
  if (typeof data.detail === 'string') return data.detail
  if (Array.isArray(data.detail)) return data.detail.filter(Boolean).join(', ')
  // DRF serializer field errors: { field: [msg, ...] | msg }
  const parts = []
  for (const value of Object.values(data)) {
    if (Array.isArray(value)) parts.push(value.filter((item) => typeof item === 'string').join(', '))
    else if (typeof value === 'string') parts.push(value)
  }
  return parts.filter(Boolean).join(' ')
}

export function createCvErrorMessage(error) {
  // No HTTP response at all: backend down, CORS, or lost connection.
  if (!error?.response) {
    return 'Không kết nối được máy chủ. Kiểm tra kết nối mạng hoặc thử lại sau ít phút.'
  }

  const { status, data } = error.response
  const detail = flattenDetail(data)

  // Prefer a specific translation when the backend named the cause.
  for (const [pattern, message] of KNOWN_PHRASES) {
    if (pattern.test(detail)) return message
  }

  switch (status) {
    case 400:
      return detail || 'Dữ liệu tạo CV không hợp lệ. Kiểm tra lại mẫu và nội dung mẫu.'
    case 401:
      return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại bằng tài khoản ứng viên.'
    case 403:
      return detail || 'Tài khoản của bạn không có quyền tạo CV. Hãy dùng tài khoản ứng viên đã xác thực email.'
    case 404:
      return detail || 'Mẫu CV không tồn tại hoặc đã bị gỡ. Hãy chọn lại mẫu.'
    case 409:
      return detail || 'CV vừa thay đổi ở nơi khác. Hãy tải lại trang rồi thử lại.'
    default:
      if (status >= 500) return 'Máy chủ đang gặp sự cố khi tạo CV. Vui lòng thử lại sau ít phút.'
      return detail || 'Không thể tạo CV lúc này. Vui lòng thử lại.'
  }
}
