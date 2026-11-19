import { m, getLocale } from '@/shared/config/i18n'
export const AI_JOB_MODES = new Set(['ai_brief', 'jd_text'])
export const TERMINAL_GENERATION_STATUSES = new Set(['completed', 'failed', 'cancelled'])

const PHASE_COPY = {
  queued: m.employer_job_ai_phase_queued,
  preparing_context: m.employer_job_ai_phase_preparing,
  generating: m.employer_job_ai_phase_generating,
  validating: m.employer_job_ai_phase_validating,
  completed: m.employer_job_ai_phase_completed,
  failed: m.employer_job_ai_title_failed,
  cancelled: m.employer_job_ai_title_cancelled,
}

export function getGenerationPhaseCopy(phase, status) {
  return (PHASE_COPY[phase] || PHASE_COPY[status] || m.employer_job_ai_phase_fallback)()
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
  if (rawLines.length > 10) return m.employer_job_ai_list_too_many()
  if (lines.some((item) => item.length > 120)) return m.employer_job_ai_list_item_too_long()
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
    locale: getLocale() === 'en' ? 'en-US' : 'vi-VN',
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
