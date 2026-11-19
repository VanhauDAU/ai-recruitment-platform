import { m } from '@/shared/config/i18n'

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
// Giữ mapping ở đây để frontend vẫn hiển thị đúng ngôn ngữ khi backend cũ chưa deploy.
const API_ERROR_MESSAGES = {
  'No active account found with the given credentials': m.api_error_invalid_credentials(),
  'No active account found with the given credentials.': m.api_error_invalid_credentials(),
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
  if (seconds < 60) return m.api_error_duration_seconds({ count: seconds })
  const minutes = Math.ceil(seconds / 60)
  if (minutes < 60) return m.api_error_duration_minutes({ count: minutes })
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  if (hours < 24) {
    return remainingMinutes
      ? m.api_error_duration_hours_minutes({ hours, minutes: remainingMinutes })
      : m.api_error_duration_hours({ count: hours })
  }
  const days = Math.floor(hours / 24)
  const remainingHours = hours % 24
  return remainingHours
    ? m.api_error_duration_days_hours({ days, hours: remainingHours })
    : m.api_error_duration_days({ count: days })
}

export function getApiErrorMessage(error, fallback = m.api_error_generic()) {
  const { response } = error || {}

  if (!response) {
    const isNetworkError = Boolean(
      error?.isAxiosError
      || ['ERR_NETWORK', 'ECONNABORTED', 'ETIMEDOUT'].includes(error?.code),
    )
    return isNetworkError
      ? m.api_error_network()
      : fallback
  }

  if (response.status >= 500 || isHtmlResponse(response.data)) {
    return m.api_error_server()
  }

  if (response.status === 429) {
    const seconds = retryAfterSeconds(response)
    return seconds
      ? m.api_error_rate_limited_wait({ duration: formatRetryDuration(seconds) })
      : m.api_error_rate_limited()
  }

  const explicitMessage = explicitApiMessage(response.data)
  if (explicitMessage) return translateApiErrorMessage(explicitMessage)

  const messages = flattenMessages(response.data)
  return messages.length ? messages.map(translateApiErrorMessage).join(' ') : fallback
}

// Mã lỗi máy-đọc từ luồng OAuth (backend redirect về ?error=<code>).
const OAUTH_ERRORS = {
  access_denied: m.api_error_oauth_access_denied(),
  provider_not_configured: m.api_error_oauth_provider_not_configured(),
  provider_not_allowed: m.api_error_oauth_provider_not_allowed(),
  portal_not_supported: m.api_error_oauth_portal_not_supported(),
  unknown_provider: m.api_error_oauth_unknown_provider(),
  invalid_state: m.api_error_oauth_invalid_state(),
  exchange_failed: m.api_error_oauth_exchange_failed(),
  profile_failed: m.api_error_oauth_profile_failed(),
  no_email: m.api_error_oauth_no_email(),
  wrong_portal: m.api_error_oauth_wrong_portal(),
  inactive: m.api_error_oauth_inactive(),
  invalid_code: m.api_error_oauth_invalid_code(),
  complete_failed: m.api_error_oauth_complete_failed(),
}

export function getOAuthErrorMessage(code) {
  if (!code) return ''
  return OAUTH_ERRORS[code] || m.api_error_oauth_failed()
}
