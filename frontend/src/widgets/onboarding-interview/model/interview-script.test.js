import { describe, expect, it } from 'vitest'
import {
  buildReadySpeech,
  clampSpeech,
  INTERVIEW_STEPS,
  MAX_SPEECH_CHARS,
  resolveSpeech,
  salarySpeech,
} from './interview-script'

const PREFERENCE = {
  desired_salary_vnd: 15_000_000,
  desired_specializations: [{ id: 1, name: 'Lập trình viên' }],
  preferred_provinces: [{ id: 3, name: 'Đà Nẵng' }],
}

describe('interview-script', () => {
  it('mỗi bước khai đủ trường và câu hỏi để đọc', () => {
    const ids = INTERVIEW_STEPS.map((step) => step.id)
    expect(new Set(ids).size).toBe(INTERVIEW_STEPS.length)
    for (const step of INTERVIEW_STEPS) {
      expect(step.fields.length).toBeGreaterThan(0)
      expect(resolveSpeech(step.speech, { name: 'Hậu' })).not.toBe('')
    }
  })

  it('chèn tên ứng viên vào câu chào của bước đầu', () => {
    expect(resolveSpeech(INTERVIEW_STEPS[0].speech, { name: 'Hậu' })).toContain('Chào Hậu!')
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

  it('cắt câu quá dài ở ranh giới từ để không vượt hạn mức backend', () => {
    const clamped = clampSpeech(`${'Xin chào bạn '.repeat(80)}kết thúc`)
    expect(clamped.length).toBeLessThanOrEqual(MAX_SPEECH_CHARS)
    expect(clamped.endsWith('bạn')).toBe(true)
  })
})
