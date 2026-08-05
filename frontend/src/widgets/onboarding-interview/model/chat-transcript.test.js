import { describe, expect, it } from 'vitest'
import { buildTranscript } from './chat-transcript'
import { INTERVIEW_STEPS } from './interview-script'

const CATALOG = {
  categories: [{ id: 1, name: 'Lập trình viên', category_type: 'specialization' }],
  provinceOptions: [{ value: 3, label: 'Đà Nẵng' }],
}

const VALUES = {
  desired_salary_vnd: 15_000_000,
  desired_specialization_ids: [1],
  experience_level: '2',
  preferred_province_ids: [3],
}

const BASE = { catalog: CATALOG, user: { full_name: 'Hậu' }, values: VALUES }

function ids(items) {
  return items.map((item) => item.id)
}

describe('buildTranscript', () => {
  it('mới chào thì chưa có câu hỏi nào', () => {
    const items = buildTranscript({ ...BASE, index: 0, phase: 'greeting' })

    expect(ids(items)).toEqual(['greeting'])
    expect(items[0].text).toContain('Chào Hậu!')
  })

  it('mỗi lượt đã trả lời để lại một cặp hỏi - đáp trong lịch sử', () => {
    const items = buildTranscript({ ...BASE, index: 1, phase: 'asking' })

    expect(ids(items)).toEqual(['greeting', 'start', 'ask-specialization', 'answer-specialization', 'ask-experience'])
    expect(items.at(-2).text).toBe('Lập trình viên')
    expect(items.at(-1).role).toBe('bot')
  })

  it('giữ lại câu robot nhắc như một lượt nói thật', () => {
    const items = buildTranscript({
      ...BASE,
      index: 0,
      nagged: { specialization: 'Bạn chọn giúp mình ít nhất một vị trí chuyên môn nhé.' },
      phase: 'asking',
    })

    expect(ids(items)).toContain('nag-specialization')
  })

  it('chốt lại bằng chính nhu cầu vừa lưu khi xong', () => {
    const items = buildTranscript({
      ...BASE,
      index: INTERVIEW_STEPS.length - 1,
      phase: 'ready',
      savedPreference: {
        desired_salary_vnd: 15_000_000,
        desired_specializations: [{ id: 1, name: 'Lập trình viên' }],
        preferred_provinces: [{ id: 3, name: 'Đà Nẵng' }],
      },
    })

    expect(ids(items)).toContain('saving')
    expect(items.at(-1).kind).toBe('ready')
    expect(items.at(-1).text).toContain('Xong rồi Hậu!')
    // Đủ năm cặp hỏi - đáp: không lượt nào bị nuốt khi chuyển sang màn chốt.
    expect(items.filter((item) => item.role === 'user' && item.stepId)).toHaveLength(INTERVIEW_STEPS.length)
  })

  it('không nuốt tin nhắn nào khi lưu hỏng, chỉ thêm lời xin lỗi', () => {
    const items = buildTranscript({
      ...BASE,
      failure: { stepId: 'salary', text: 'Mức lương chưa hợp lệ.' },
      index: INTERVIEW_STEPS.length - 1,
      phase: 'retry',
    })

    expect(ids(items)).toContain('saving')
    expect(items.at(-1).text).toBe('Mức lương chưa hợp lệ.')
  })
})
