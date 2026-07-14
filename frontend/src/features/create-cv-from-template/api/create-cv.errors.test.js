import { describe, expect, it } from 'vitest'

import { createCvErrorMessage } from './create-cv.errors'

const withResponse = (status, data) => ({ response: { status, data } })

describe('createCvErrorMessage', () => {
  it('reports a connection problem when there is no response', () => {
    expect(createCvErrorMessage(new Error('Network Error'))).toMatch(/không kết nối được máy chủ/i)
    expect(createCvErrorMessage({})).toMatch(/không kết nối được máy chủ/i)
  })

  it('maps the email-verification policy error', () => {
    const message = createCvErrorMessage(withResponse(403, { detail: 'Verify your email before creating a CV.' }))
    expect(message).toMatch(/xác thực email/i)
  })

  it('maps an unpublished template', () => {
    const message = createCvErrorMessage(withResponse(403, { detail: 'The selected template does not have a published version.' }))
    expect(message).toMatch(/chưa được xuất bản/i)
  })

  it('surfaces DRF field errors for an unknown template (400)', () => {
    const message = createCvErrorMessage(withResponse(400, { template_public_id: ['Unknown template.'] }))
    expect(message).toMatch(/mẫu cv không tồn tại/i)
  })

  it('maps an unknown sample content field error', () => {
    const message = createCvErrorMessage(withResponse(400, { sample_content_public_id: ['Unknown sample content.'] }))
    expect(message).toMatch(/nội dung mẫu không tồn tại/i)
  })

  it('maps a sample locale mismatch', () => {
    const message = createCvErrorMessage(withResponse(400, { sample_content_public_id: ['Sample locale must match language.'] }))
    expect(message).toMatch(/không cùng ngôn ngữ/i)
  })

  it('maps an unavailable taxonomy position', () => {
    const message = createCvErrorMessage(withResponse(400, {
      position_public_id: ['Unknown active specialization.'],
    }))
    expect(message).toMatch(/vị trí chuyên môn không tồn tại/i)
  })

  it('treats 401 as an expired session', () => {
    expect(createCvErrorMessage(withResponse(401, {}))).toMatch(/đăng nhập lại/i)
  })

  it('gives a distinct 5xx server message', () => {
    expect(createCvErrorMessage(withResponse(500, {}))).toMatch(/máy chủ đang gặp sự cố/i)
  })

  it('falls back to the server detail for an unmapped 400', () => {
    const message = createCvErrorMessage(withResponse(400, { detail: 'Something specific.' }))
    expect(message).toBe('Something specific.')
  })
})
