import { describe, expect, it } from 'vitest'
import { analysisErrorCopy, bandOf, isAnalysisActive, requestErrorCopy } from './job-fit'

describe('job fit model', () => {
  it('polls only while the analysis is queued or processing', () => {
    expect(isAnalysisActive({ status: 'queued' })).toBe(true)
    expect(isAnalysisActive({ status: 'processing' })).toBe(true)
    expect(isAnalysisActive({ status: 'succeeded' })).toBe(false)
    expect(isAnalysisActive(null)).toBe(false)
  })

  it('maps scores to the same bands as the backend', () => {
    expect([0, 49, 50, 64, 65, 79, 80, 100].map((score) => bandOf(score).key)).toEqual([
      'low', 'low', 'medium', 'medium', 'high', 'high', 'very_high', 'very_high',
    ])
  })

  it('explains request and analysis errors in plain words', () => {
    expect(requestErrorCopy({ response: { status: 429, data: {} } })).toMatch(/nhiều lần/)
    expect(requestErrorCopy({ response: { status: 403, data: { code: 'feature_disabled' } } })).toMatch(/tạm tắt/)
    expect(requestErrorCopy(new Error('network'))).toMatch(/Chưa gửi được/)
    expect(analysisErrorCopy('cv_text_unavailable')).toMatch(/bản scan/)
    expect(analysisErrorCopy('unknown')).toMatch(/Chưa phân tích được/)
  })
})
