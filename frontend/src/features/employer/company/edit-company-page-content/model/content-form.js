import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { m } from '@/shared/config/i18n'

export const CONTENT_STATUS = {
  published: ['green', m.employer_company_content_status_published()],
  pending: ['gold', m.employer_company_content_status_pending()],
  changes_requested: ['orange', m.employer_company_content_status_changes_requested()],
  empty: ['default', m.employer_company_content_status_empty()],
}

// Mục của thước đo hoàn thiện → thẻ nội dung chứa trường đó.
const COMPLETENESS_CARD = { logo: 'hero', cover: 'hero', headline: 'hero' }

export const contentCardId = (card) => `company-content-${card}`
export const completenessCardId = (itemKey) => contentCardId(COMPLETENESS_CARD[itemKey] || itemKey)

/** Giá trị form khởi tạo: bản đang chờ duyệt của tôi nếu khoá đó có trong `pending`, không thì bản công khai. */
export function contentValue(contentForm, key) {
  const pending = contentForm?.pending
  return pending && Object.hasOwn(pending, key) ? pending[key] : contentForm?.published?.[key]
}

/** Nội dung lưu là đăng ngay (hậu kiểm), trừ khi quản trị viên bật duyệt trước cho công ty. */
export const isDirectPublish = (contentForm) => contentForm?.review_mode === 'direct'

/** Trạng thái, ghi chú duyệt và cách lưu dùng chung cho mọi thẻ. */
export function cardStatus(page, card) {
  const form = page.content_form
  return { status: form.section_status?.[card], reviewNote: form.request?.review_note, direct: isDirectPublish(form) }
}

/** Chỉ giữ các khoá có giá trị khác giá trị khởi tạo. */
export function changedFields(next, initial) {
  return Object.fromEntries(
    Object.entries(next).filter(([key, value]) => JSON.stringify(value) !== JSON.stringify(initial[key])),
  )
}

/**
 * Lỗi 400 `{field: [câu]}` (danh sách/đối tượng lồng theo chỉ số/khoá) thành
 * `[{ name: path[], errors }]` cho `form.setFields`. Chấp nhận cả dạng bọc trong `changes`.
 */
export function contentFieldErrors(data, path = []) {
  if (path.length === 0 && data?.changes && typeof data.changes === 'object') {
    const { changes, ...rest } = data
    return [...contentFieldErrors(changes), ...contentFieldErrors(rest)]
  }
  if (typeof data === 'string') return [{ name: path, errors: [data] }]
  if (Array.isArray(data)) {
    if (data.every((item) => typeof item === 'string')) return data.length ? [{ name: path, errors: data }] : []
    return data.flatMap((item, index) => contentFieldErrors(item, [...path, index]))
  }
  if (data && typeof data === 'object') {
    return Object.entries(data)
      .filter(([key]) => path.length > 0 || key !== 'code')
      .flatMap(([key, value]) => contentFieldErrors(value, [...path, key]))
  }
  return []
}

/** Phân loại lỗi khi gửi nội dung để thẻ biết hiển thị gì và có cần tải lại workspace. */
export function contentSubmitOutcome(error) {
  if (error?.mediaFailed) {
    return { kind: 'media', message: m.employer_company_content_media_failed() }
  }
  const { status, data } = error?.response || {}
  if (status === 409 && data?.code === 'COMPANY_UPDATE_IN_REVIEW') {
    return { kind: 'in_review', message: data.detail || m.employer_company_content_in_review() }
  }
  if (status === 403) {
    return { kind: 'forbidden', message: getApiErrorMessage(error, m.employer_company_content_forbidden()) }
  }
  if (status === 400) return { kind: 'invalid', fields: contentFieldErrors(data) }
  return { kind: 'failed', message: getApiErrorMessage(error, m.employer_company_content_save_failed()) }
}
