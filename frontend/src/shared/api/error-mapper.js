function isHtmlResponse(value) {
  if (typeof value !== 'string') return false
  const normalized = value.trim().toLowerCase()
  return normalized.startsWith('<!doctype html') || normalized.startsWith('<html') || normalized.includes('<body')
}

// Khoá máy-đọc trong payload lỗi (vd SimpleJWT trả {detail, code}) — không ghép
// vào chuỗi hiển thị, nếu không người dùng thấy "... no_active_account".
const MACHINE_READABLE_KEYS = new Set(['code', 'codes', 'error_code', 'error'])

function flattenMessages(value) {
  if (!value || isHtmlResponse(value)) return []
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.flatMap(flattenMessages)
  if (typeof value === 'object') {
    return Object.entries(value)
      .filter(([key]) => !MACHINE_READABLE_KEYS.has(key))
      .flatMap(([, item]) => flattenMessages(item))
  }
  return []
}

// Một số lỗi mặc định của thư viện xác thực phía backend là tiếng Anh.
// Giữ mapping ở đây để frontend vẫn hiển thị tiếng Việt khi backend cũ chưa deploy.
const API_ERROR_MESSAGES = {
  'No active account found with the given credentials': 'Email hoặc mật khẩu không đúng. Vui lòng thử lại.',
  'No active account found with the given credentials.': 'Email hoặc mật khẩu không đúng. Vui lòng thử lại.',
}

function translateApiErrorMessage(message) {
  const normalized = message.trim()
  return API_ERROR_MESSAGES[normalized] || message
}

function explicitApiMessage(data) {
  if (!data || typeof data !== 'object') return ''
  if (typeof data.message === 'string') return data.message
  if (
    data.detail
    && typeof data.detail === 'object'
    && typeof data.detail.message === 'string'
  ) {
    return data.detail.message
  }
  if (typeof data.detail === 'string') return data.detail
  return ''
}

function retryAfterSeconds(response) {
  const headers = response?.headers
  const headerValue = typeof headers?.get === 'function'
    ? headers.get('retry-after')
    : headers?.['retry-after']
  const detail = typeof response?.data?.detail === 'string' ? response.data.detail : ''
  const detailValue = detail.match(/(?:in|sau)\s+(\d+)\s+seconds?/i)?.[1]
  const value = Number(headerValue ?? response?.data?.wait ?? detailValue)
  return Number.isFinite(value) && value > 0 ? Math.ceil(value) : 0
}

function formatRetryDuration(seconds) {
  if (seconds < 60) return `${seconds} giây`
  const minutes = Math.ceil(seconds / 60)
  if (minutes < 60) return `${minutes} phút`
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  if (hours < 24) {
    return remainingMinutes ? `${hours} giờ ${remainingMinutes} phút` : `${hours} giờ`
  }
  const days = Math.floor(hours / 24)
  const remainingHours = hours % 24
  return remainingHours ? `${days} ngày ${remainingHours} giờ` : `${days} ngày`
}

export function getApiErrorMessage(error, fallback = 'Có lỗi xảy ra, vui lòng thử lại.') {
  const { response } = error || {}

  if (!response) {
    const isNetworkError = Boolean(
      error?.isAxiosError
      || ['ERR_NETWORK', 'ECONNABORTED', 'ETIMEDOUT'].includes(error?.code),
    )
    return isNetworkError
      ? 'Không kết nối được máy chủ. Vui lòng kiểm tra backend đang chạy và thử lại.'
      : fallback
  }

  if (response.status >= 500 || isHtmlResponse(response.data)) {
    return 'Hệ thống đang gặp lỗi. Vui lòng thử lại sau ít phút.'
  }

  if (response.status === 429) {
    const seconds = retryAfterSeconds(response)
    return seconds
      ? `Bạn đã thao tác quá số lần cho phép. Vui lòng thử lại sau ${formatRetryDuration(seconds)}.`
      : 'Bạn đã thao tác quá số lần cho phép. Vui lòng thử lại sau.'
  }

  const explicitMessage = explicitApiMessage(response.data)
  if (explicitMessage) return translateApiErrorMessage(explicitMessage)

  const messages = flattenMessages(response.data)
  return messages.length ? messages.map(translateApiErrorMessage).join(' ') : fallback
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
