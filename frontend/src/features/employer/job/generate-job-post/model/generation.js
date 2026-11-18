export const AI_JOB_MODES = new Set(['ai_brief', 'jd_text'])
export const TERMINAL_GENERATION_STATUSES = new Set(['completed', 'failed', 'cancelled'])

const PHASE_COPY = {
  queued: 'Đang xếp hàng',
  preparing_context: 'Đang chuẩn bị dữ liệu công ty',
  generating: 'Đang viết nội dung tuyển dụng',
  validating: 'Đang kiểm tra kết quả',
  completed: 'Bản nháp AI đã sẵn sàng',
  failed: 'Chưa thể tạo bản nháp',
  cancelled: 'Đã hủy yêu cầu',
}

export function getGenerationPhaseCopy(phase, status) {
  return PHASE_COPY[phase] || PHASE_COPY[status] || 'Đang xử lý yêu cầu'
}

export function isGenerationActive(generation) {
  return Boolean(generation?.status) && !TERMINAL_GENERATION_STATUSES.has(generation.status)
}

export function linesToItems(value) {
  return String(value || '')
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 10)
}

export function getGenerationListFieldError(value) {
  const lines = linesToItems(value)
  const rawLines = String(value || '').split('\n').map((item) => item.trim()).filter(Boolean)
  if (rawLines.length > 10) return 'Tối đa 10 ý, mỗi ý trên một dòng.'
  if (lines.some((item) => item.length > 120)) return 'Mỗi ý tối đa 120 ký tự.'
  return ''
}

export function createGenerationIdempotencyKey() {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID()
  return `job-ai-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`
}

export function buildGenerationPayload(mode, draft) {
  const common = {
    mode,
    idempotency_key: createGenerationIdempotencyKey(),
    locale: 'vi-VN',
  }

  if (mode === 'jd_text') {
    return { ...common, source_text: String(draft?.source_text || '').trim() }
  }

  const brief = {
    position: String(draft?.position || '').trim(),
    responsibilities: linesToItems(draft?.responsibilities),
    requirements: linesToItems(draft?.requirements),
    preferred_skills: linesToItems(draft?.preferred_skills),
    notes: String(draft?.notes || '').trim(),
  }
  if (draft?.position_level) brief.position_level = draft.position_level
  if (draft?.employment_type) brief.employment_type = draft.employment_type
  if (draft?.work_types?.length) brief.work_types = draft.work_types

  return { ...common, brief }
}
