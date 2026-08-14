import { describe, expect, it } from 'vitest'
import {
  answerSummary,
  buildReadySpeech,
  clampSpeech,
  greetingSpeech,
  INTERVIEW_STEPS,
  MAX_SPEECH_CHARS,
  salarySpeech,
  stepById,
} from './interview-script'

const PREFERENCE = {
  desired_salary_vnd: 15_000_000,
  desired_specializations: [{ id: 1, name: 'Lập trình viên' }],
  preferred_provinces: [{ id: 3, name: 'Đà Nẵng' }],
}

const CATALOG = {
  categories: [{ id: 1, name: 'Lập trình viên', category_type: 'specialization' }],
  provinceOptions: [{ value: 3, label: 'Đà Nẵng' }],
}

describe('interview-script', () => {
  it('mỗi lượt hỏi khai đủ trường, câu hỏi và cách dựng đáp án', () => {
    const ids = INTERVIEW_STEPS.map((step) => step.id)
    expect(new Set(ids).size).toBe(INTERVIEW_STEPS.length)
    for (const step of INTERVIEW_STEPS) {
      expect(step.fields.length).toBeGreaterThan(0)
      expect(step.question).not.toBe('')
      expect(typeof step.answer).toBe('function')
    }
  })

  it('chào ứng viên bằng tên trước khi vào câu hỏi đầu tiên', () => {
    expect(greetingSpeech({ full_name: 'Hậu' })).toContain('Chào Hậu!')
    expect(greetingSpeech(null)).toContain('Chào bạn!')
  })

  it('dựng đáp án thành tin nhắn đọc lại được của ứng viên', () => {
    const values = {
      desired_salary_vnd: 15_000_000,
      desired_specialization_ids: [1],
      desired_position_others: ['Kỹ sư cầu nối', 'Business Analyst'],
      experience_level: '2',
      preferred_province_ids: [3],
      willing_to_relocate: true,
      ai_recommendation_consent: true,
      recruiter_visibility_consent: false,
    }

    expect(answerSummary(stepById('specialization'), values, CATALOG)).toBe('Lập trình viên · Kỹ sư cầu nối · Business Analyst')
    expect(answerSummary(stepById('experience'), values, CATALOG)).toBe('2 năm')
    expect(answerSummary(stepById('salary'), values, CATALOG)).toBe('15.000.000 VND/tháng')
    expect(answerSummary(stepById('location'), values, CATALOG)).toBe('Đà Nẵng · Sẵn sàng đổi nơi làm việc')
    expect(answerSummary(stepById('consent'), values, CATALOG)).toBe('Mình đồng ý nhận gợi ý việc làm từ hệ thống.')
  })

  it('nói rõ khi ứng viên không đồng ý mục nào', () => {
    expect(answerSummary(stepById('consent'), {}, CATALOG)).toBe('Mình chưa đồng ý mục nào.')
  })

  it('đọc lương tròn triệu theo cách nói tự nhiên', () => {
    expect(salarySpeech(15_000_000)).toBe('15 triệu')
    expect(salarySpeech(12_500_000)).toBe('12.500.000 đồng')
    expect(salarySpeech(null)).toBe('')
  })

  it('dựng câu chốt từ chính nhu cầu vừa lưu', () => {
    const speech = buildReadySpeech(PREFERENCE, { full_name: 'Hậu' })
    expect(speech).toContain('Xong rồi Hậu!')
    expect(speech).toContain('việc làm Lập trình viên')
    expect(speech).toContain('tại Đà Nẵng')
    expect(speech).toContain('15 triệu')
  })

  it('gộp phần dư khi chọn nhiều lĩnh vực và tỉnh thành', () => {
    const speech = buildReadySpeech({
      ...PREFERENCE,
      desired_specializations: [1, 2, 3, 4].map((id) => ({ id, name: `Nghề ${id}` })),
      preferred_provinces: [1, 2, 3].map((id) => ({ id, name: `Tỉnh ${id}` })),
    }, null)
    expect(speech).toContain('Nghề 1 và Nghề 2 cùng 2 lĩnh vực khác')
    expect(speech).toContain('Tỉnh 1 và Tỉnh 2 cùng 1 tỉnh thành khác')
  })

  it('vẫn có câu chốt khi thiếu dữ liệu', () => {
    expect(buildReadySpeech(null, null)).toContain('danh sách việc làm phù hợp')
  })

  it('đưa vị trí tự nhập vào câu chốt sau khi lưu', () => {
    expect(buildReadySpeech({ desired_position_others: ['Kỹ sư dữ liệu'] }, null)).toContain('Kỹ sư dữ liệu')
  })

  it('cắt câu quá dài ở ranh giới từ để không vượt hạn mức backend', () => {
    const clamped = clampSpeech(`${'Xin chào bạn '.repeat(80)}kết thúc`)
    expect(clamped.length).toBeLessThanOrEqual(MAX_SPEECH_CHARS)
    expect(clamped.endsWith('bạn')).toBe(true)
  })
})
