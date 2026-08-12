import { describe, expect, it } from 'vitest'
import { buildGenerationPayload, getGenerationPhaseCopy, linesToItems } from './generation'

describe('job AI generation model', () => {
  it('normalizes a guided brief and caps line lists at ten items', () => {
    const payload = buildGenerationPayload('ai_brief', {
      position: '  Backend Engineer ',
      position_level: 'senior',
      responsibilities: Array.from({ length: 12 }, (_, index) => ` Việc ${index + 1} `).join('\n'),
      requirements: '\nPython\nDjango\n',
      preferred_skills: '',
      notes: '  Xây đội ngũ mới  ',
    })

    expect(payload).toMatchObject({
      mode: 'ai_brief',
      locale: 'vi-VN',
      brief: {
        position: 'Backend Engineer',
        position_level: 'senior',
        requirements: ['Python', 'Django'],
        notes: 'Xây đội ngũ mới',
      },
    })
    expect(payload.idempotency_key).toBeTruthy()
    expect(payload.brief.responsibilities).toHaveLength(10)
  })

  it('normalizes pasted JD text and exposes accessible phase copy', () => {
    expect(buildGenerationPayload('jd_text', { source_text: '  Nội dung JD  ' })).toMatchObject({
      mode: 'jd_text',
      source_text: 'Nội dung JD',
    })
    expect(linesToItems(' Một\n\n Hai ')).toEqual(['Một', 'Hai'])
    expect(getGenerationPhaseCopy('validating')).toBe('Đang kiểm tra kết quả')
  })
})
