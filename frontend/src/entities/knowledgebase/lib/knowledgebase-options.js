export const KNOWLEDGE_ARTICLE_TYPES = [
  { value: 'FAQ', label: 'Câu hỏi thường gặp' },
  { value: 'GUIDE', label: 'Hướng dẫn' },
]

export const KNOWLEDGE_REVISION_STATUS = {
  DRAFT: { label: 'Bản nháp', color: 'default' },
  IN_REVIEW: { label: 'Chờ duyệt', color: 'processing' },
  APPROVED: { label: 'Đã duyệt', color: 'success' },
  REJECTED: { label: 'Cần chỉnh sửa', color: 'error' },
}

export const KNOWLEDGE_LIFECYCLE_STATUS = {
  ACTIVE: { label: 'Đang hoạt động', color: 'success' },
  ARCHIVED: { label: 'Đã lưu trữ', color: 'default' },
}

export function knowledgeTypeLabel(type) {
  return KNOWLEDGE_ARTICLE_TYPES.find((item) => item.value === type)?.label || type
}

export function knowledgeErrorMessage(error, fallback = 'Thao tác không thành công.') {
  const response = error?.response?.data
  if (typeof response?.detail === 'string') return response.detail
  if (!response || typeof response !== 'object') return fallback
  const first = Object.values(response).flat(Infinity).find((item) => typeof item === 'string')
  return first || fallback
}

export function isKnowledgeConflict(error) {
  return error?.response?.status === 409
}

export function formatKnowledgeDate(value, { withTime = false } = {}) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(new Date(value))
}
