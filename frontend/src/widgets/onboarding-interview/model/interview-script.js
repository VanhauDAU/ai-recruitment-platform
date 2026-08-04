// Kịch bản phỏng vấn onboarding.
//
// `speech` vừa là câu robot đọc vừa là phụ đề trong bong bóng thoại — cùng một
// chuỗi nên chữ chạy khớp tiếng, và tắt tiếng thì vẫn đọc được đúng câu hỏi đó.
// `label` chỉ là nhãn ngắn cho thanh tiến trình, `hint` là dòng phụ dưới control.

/** Backend chặn text đọc ad-hoc ở 600 ký tự (`SPEECH_MAX_ADHOC_TEXT_CHARS`). */
export const MAX_SPEECH_CHARS = 600

export const INTERVIEW_STEPS = [
  {
    id: 'specialization',
    needsCatalog: true,
    fields: ['desired_specialization_ids', 'desired_position_other'],
    label: 'Lĩnh vực',
    hint: 'Chọn tối đa 5 vị trí chuyên môn. Không thấy vị trí của bạn thì gõ thêm bên dưới nhé.',
    speech: ({ name }) => `Chào ${name}! Mình là trợ lý ProCV, mình sẽ hỏi bạn năm câu thật nhanh. Đầu tiên, bạn muốn làm ở lĩnh vực nào? Chọn tối đa năm vị trí chuyên môn nhé.`,
    retrySpeech: 'Bạn chọn giúp mình ít nhất một vị trí chuyên môn nhé.',
  },
  {
    id: 'experience',
    fields: ['experience_level'],
    label: 'Kinh nghiệm',
    hint: 'Chọn mốc gần đúng nhất là được.',
    speech: 'Bạn đã đi làm trong lĩnh vực này bao lâu rồi?',
    retrySpeech: 'Bạn chọn giúp mình số năm kinh nghiệm nhé.',
  },
  {
    id: 'salary',
    fields: ['desired_salary_vnd'],
    label: 'Mức lương',
    hint: 'Con số này chỉ dùng để lọc việc phù hợp, nhà tuyển dụng không nhìn thấy.',
    speech: 'Mức lương mong muốn mỗi tháng của bạn là bao nhiêu?',
    retrySpeech: 'Bạn nhập giúp mình mức lương mong muốn nhé.',
  },
  {
    id: 'location',
    needsCatalog: true,
    fields: ['preferred_province_ids', 'willing_to_relocate'],
    label: 'Địa điểm',
    hint: 'Chọn được nhiều tỉnh thành cùng lúc.',
    speech: 'Bạn muốn làm việc ở tỉnh thành nào?',
    retrySpeech: 'Bạn chọn giúp mình ít nhất một tỉnh thành nhé.',
  },
  {
    id: 'consent',
    fields: ['ai_recommendation_consent', 'recruiter_visibility_consent'],
    label: 'Cho phép',
    hint: 'Bạn có thể đổi lại bất cứ lúc nào trong phần cài đặt tài khoản.',
    speech: 'Câu cuối rồi. Mình xin phép hai điều nhỏ để gợi ý việc làm chính xác hơn cho bạn.',
    retrySpeech: '',
  },
]

export const SAVING_SPEECH = 'Chờ mình một chút, mình đang lọc việc làm phù hợp cho bạn.'

export const ERROR_SPEECH = 'Xin lỗi bạn, mình chưa lưu được. Bạn kiểm tra lại giúp mình nhé.'

export function candidateName(user) {
  return user?.full_name?.trim() || 'bạn'
}

export function welcomeBubble(user) {
  return `Chào ${candidateName(user)}! Mình là trợ lý ProCV. Bấm "Bắt đầu" đi, mình hỏi bạn năm câu thật nhanh rồi lọc sẵn việc làm hợp gu cho bạn.`
}

export function resolveSpeech(speech, context) {
  return typeof speech === 'function' ? speech(context) : speech || ''
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
  const jobs = joinNames(preference?.desired_specializations, 'lĩnh vực')
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
