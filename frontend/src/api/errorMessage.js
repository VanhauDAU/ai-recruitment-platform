function isHtmlResponse(value) {
  if (typeof value !== 'string') return false
  const normalized = value.trim().toLowerCase()
  return normalized.startsWith('<!doctype html') || normalized.startsWith('<html') || normalized.includes('<body')
}

function flattenMessages(value) {
  if (!value || isHtmlResponse(value)) return []
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.flatMap(flattenMessages)
  if (typeof value === 'object') return Object.values(value).flatMap(flattenMessages)
  return []
}

export function getApiErrorMessage(error, fallback = 'Có lỗi xảy ra, vui lòng thử lại.') {
  const { response } = error || {}

  if (!response) {
    return 'Không kết nối được máy chủ. Vui lòng kiểm tra backend đang chạy và thử lại.'
  }

  if (response.status >= 500 || isHtmlResponse(response.data)) {
    return 'Hệ thống đang gặp lỗi. Vui lòng thử lại sau ít phút.'
  }

  const messages = flattenMessages(response.data)
  return messages.length ? messages.join(' ') : fallback
}

// Mã lỗi máy-đọc từ luồng OAuth (backend redirect về ?error=<code>).
const OAUTH_ERRORS = {
  access_denied: 'Bạn đã huỷ đăng nhập với nhà cung cấp. Vui lòng thử lại.',
  provider_not_configured: 'Phương thức đăng nhập này chưa được cấu hình trên hệ thống.',
  provider_not_allowed: 'Cổng này không hỗ trợ phương thức đăng nhập vừa chọn.',
  portal_not_supported: 'Cổng này không hỗ trợ đăng nhập mạng xã hội.',
  unknown_provider: 'Phương thức đăng nhập không hợp lệ.',
  invalid_state: 'Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng thử lại.',
  exchange_failed: 'Không kết nối được với nhà cung cấp đăng nhập. Vui lòng thử lại.',
  profile_failed: 'Không đọc được thông tin tài khoản từ nhà cung cấp. Vui lòng thử lại.',
  no_email: 'Tài khoản mạng xã hội không cung cấp email. Vui lòng dùng tài khoản khác hoặc đăng ký bằng email.',
  wrong_portal: 'Tài khoản không thuộc cổng này. Email đã được đăng ký với vai trò khác.',
  inactive: 'Tài khoản đã bị khoá hoặc vô hiệu hoá.',
  invalid_code: 'Mã đăng nhập không hợp lệ. Vui lòng thử lại.',
  complete_failed: 'Đăng nhập chưa hoàn tất được. Vui lòng thử lại.',
}

export function getOAuthErrorMessage(code) {
  if (!code) return ''
  return OAUTH_ERRORS[code] || 'Đăng nhập mạng xã hội thất bại. Vui lòng thử lại.'
}
