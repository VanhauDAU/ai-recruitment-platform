import { getIntlLocale } from '@/shared/config/i18n'
export const KNOWLEDGE_ARTICLE_TYPES = [
  { value: 'FAQ', label: 'Câu hỏi thường gặp' },
  { value: 'GUIDE', label: 'Hướng dẫn' },
]

export const KNOWLEDGE_REVISION_STATUS = {
  DRAFT: { label: 'Bản nháp', color: 'processing' },
  PUBLISHED: { label: 'Đã xuất bản', color: 'success' },
}

/** Nhãn trạng thái của một dòng bài viết: bản nháp đè lên bài đang công khai đọc là "Có bản nháp". */
export function knowledgeLatestStatus({ latest_revision: latest, published_revision_number: publishedNumber } = {}) {
  if (!latest) return null
  if (latest.status === 'DRAFT' && publishedNumber) return { label: 'Có bản nháp', color: 'processing' }
  return KNOWLEDGE_REVISION_STATUS[latest.status] || null
}

/** Trạng thái bài trong workspace: công khai bản nào, có bản nháp nào đang chờ xuất bản. */
export function knowledgeArticleState(article) {
  if (!article) return []
  const draft = article.revisions?.find((item) => item.status === 'DRAFT')
  const tags = []
  if (article.lifecycle_state === 'ARCHIVED') tags.push({ label: 'Đã lưu trữ', color: 'default' })
  else if (article.published_revision_number) tags.push({ label: `Đang công khai r${article.published_revision_number}`, color: 'success' })
  else tags.push({ label: 'Chưa xuất bản', color: 'default' })
  if (draft) tags.push({ label: `Bản nháp r${draft.number}`, color: 'processing' })
  return tags
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
  return new Intl.DateTimeFormat(getIntlLocale(), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(new Date(value))
}
