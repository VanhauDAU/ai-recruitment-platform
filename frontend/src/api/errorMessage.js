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
