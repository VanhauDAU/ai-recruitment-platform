// Kịch bản trò chuyện onboarding.
//
// Mỗi bước là một lượt hỏi của robot. `question` vừa là câu robot đọc vừa là
// nội dung bong bóng chat — cùng một chuỗi nên chữ chạy khớp tiếng, và tắt
// tiếng thì vẫn đọc được đúng câu hỏi đó. `answer` dựng đáp án của ứng viên
// thành một tin nhắn để lịch sử hội thoại đọc lại được như chat thật.

import { EXPERIENCE_OPTIONS, normalizeDesiredPositionOthers } from '@/features/configure-job-preferences'

/** Backend chặn text đọc ad-hoc ở 600 ký tự (`SPEECH_MAX_ADHOC_TEXT_CHARS`). */
export const MAX_SPEECH_CHARS = 600

/** Lời chào chỉ có một cử chỉ trả lời — cũng là cử chỉ mở Web Audio. */
export const START_REPLY = 'Bắt đầu thôi!'

function specializationNames(ids = [], catalog) {
  const selected = new Set(ids)
  return (catalog?.categories || [])
    .filter((item) => item.category_type === 'specialization' && selected.has(item.id))
    .map((item) => item.name)
}

function provinceNames(ids = [], catalog) {
  const labels = new Map((catalog?.provinceOptions || []).map((item) => [item.value, item.label]))
  return ids.map((id) => labels.get(id)).filter(Boolean)
}

export const INTERVIEW_STEPS = [
  {
    id: 'specialization',
    needsCatalog: true,
    fields: ['desired_specialization_ids', 'desired_position_others', 'desired_position_other'],
    label: 'Lĩnh vực',
    hint: 'Chọn tối đa 5 vị trí chuyên môn. Không thấy vị trí của bạn thì gõ thêm bên dưới nhé.',
    question: 'Đầu tiên, bạn muốn làm ở lĩnh vực nào? Bạn chọn tối đa năm vị trí chuyên môn nhé.',
    retry: 'Bạn chọn giúp mình ít nhất một vị trí chuyên môn nhé.',
    answer: (values, catalog) => [
      ...specializationNames(values.desired_specialization_ids, catalog),
      ...normalizeDesiredPositionOthers(values.desired_position_others ?? values.desired_position_other),
    ].filter(Boolean).join(' · '),
  },
  {
    id: 'experience',
    fields: ['experience_level'],
    label: 'Kinh nghiệm',
    hint: 'Chọn mốc gần đúng nhất là được.',
    question: 'Bạn đã đi làm trong lĩnh vực này bao lâu rồi?',
    retry: 'Bạn chọn giúp mình số năm kinh nghiệm nhé.',
    answer: (values) => EXPERIENCE_OPTIONS.find((item) => item.value === values.experience_level)?.label || '',
  },
  {
    id: 'salary',
    fields: ['desired_salary_vnd'],
    label: 'Mức lương',
    hint: 'Con số này chỉ dùng để lọc việc phù hợp, nhà tuyển dụng không nhìn thấy.',
    question: 'Mức lương mong muốn mỗi tháng của bạn là bao nhiêu?',
    retry: 'Bạn nhập giúp mình mức lương mong muốn nhé.',
    answer: (values) => (values.desired_salary_vnd
      ? `${new Intl.NumberFormat('vi-VN').format(values.desired_salary_vnd)} VND/tháng`
      : ''),
  },
  {
    id: 'location',
    needsCatalog: true,
    fields: ['preferred_province_ids', 'willing_to_relocate'],
    label: 'Địa điểm',
    hint: 'Chọn được nhiều tỉnh thành cùng lúc.',
    question: 'Bạn muốn làm việc ở tỉnh thành nào?',
    retry: 'Bạn chọn giúp mình ít nhất một tỉnh thành nhé.',
    answer: (values, catalog) => [
      provinceNames(values.preferred_province_ids, catalog).join(' · '),
      values.willing_to_relocate && 'Sẵn sàng đổi nơi làm việc',
    ].filter(Boolean).join(' · '),
  },
  {
    id: 'consent',
    fields: ['ai_recommendation_consent', 'recruiter_visibility_consent'],
    label: 'Cho phép',
    hint: 'Bạn có thể đổi lại bất cứ lúc nào trong phần cài đặt tài khoản.',
    question: 'Câu cuối rồi. Mình xin phép hai điều nhỏ để gợi ý việc làm chính xác hơn cho bạn nhé.',
    retry: '',
    answer: (values) => {
      const allowed = [
        values.ai_recommendation_consent && 'nhận gợi ý việc làm từ hệ thống',
        values.recruiter_visibility_consent && 'cho nhà tuyển dụng xem hồ sơ của mình',
      ].filter(Boolean)
      return allowed.length ? `Mình đồng ý ${allowed.join(' và ')}.` : 'Mình chưa đồng ý mục nào.'
    },
  },
]

export const SAVING_SPEECH = 'Chờ mình một chút, mình đang lọc việc làm phù hợp cho bạn.'

export function candidateName(user) {
  return user?.full_name?.trim() || 'bạn'
}

export function greetingSpeech(user) {
  return `Chào ${candidateName(user)}! Mình là trợ lý ProCV. Mình hỏi bạn năm câu thật nhanh rồi lọc sẵn việc làm hợp gu cho bạn nhé.`
}

export function stepById(id) {
  return INTERVIEW_STEPS.find((step) => step.id === id) || null
}

export function answerSummary(step, values, catalog) {
  return step?.answer?.(values || {}, catalog || {}) || ''
}

/** Cắt ở ranh giới câu/từ gần nhất để không đọc dở một chữ. */
export function clampSpeech(text, max = MAX_SPEECH_CHARS) {
  const value = String(text || '').trim()
  if (value.length <= max) return value
  const head = value.slice(0, max)
  const cut = Math.max(head.lastIndexOf('. '), head.lastIndexOf(', '), head.lastIndexOf(' '))
  return (cut > 0 ? head.slice(0, cut) : head).trim()
}

function joinNames(items = [], moreNoun = '', limit = 2) {
  const names = items.map((item) => item?.name).filter(Boolean)
  if (!names.length) return ''
  const head = names.slice(0, limit).join(' và ')
  const rest = names.length - Math.min(names.length, limit)
  return rest > 0 ? `${head} cùng ${rest} ${moreNoun} khác` : head
}

/** "15 triệu" đọc trôi hơn "15.000.000"; số lẻ mới đọc theo đồng. */
export function salarySpeech(amount) {
  const value = Number(amount)
  if (!Number.isFinite(value) || value < 1) return ''
  if (value % 1_000_000 === 0) return `${value / 1_000_000} triệu`
  return `${new Intl.NumberFormat('vi-VN').format(value)} đồng`
}

/** Câu chốt cá nhân hoá, dựng từ chính nhu cầu vừa lưu. */
export function buildReadySpeech(preference, user) {
  const customPositions = normalizeDesiredPositionOthers(
    preference?.desired_position_others ?? preference?.desired_position_other,
  ).map((name) => ({ name }))
  const jobs = joinNames([...(preference?.desired_specializations || []), ...customPositions], 'lĩnh vực')
  const places = joinNames(preference?.preferred_provinces, 'tỉnh thành')
  const salary = salarySpeech(preference?.desired_salary_vnd)

  const details = [
    jobs && `việc làm ${jobs}`,
    places && `tại ${places}`,
    salary && `với mức lương từ ${salary} một tháng`,
  ].filter(Boolean).join(' ')

  const body = details
    ? `mình đã lọc sẵn ${details} cho bạn`
    : 'mình đã lọc sẵn danh sách việc làm phù hợp cho bạn'

  return clampSpeech(`Xong rồi ${candidateName(user)}! Theo những gì bạn vừa chia sẻ, ${body}. Cùng xem ngay nhé!`)
}
