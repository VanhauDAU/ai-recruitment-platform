import { describe, expect, it } from 'vitest'
import {
  changedFields,
  completenessCardId,
  contentFieldErrors,
  contentSubmitOutcome,
  contentValue,
} from './content-form'

const apiError = (status, data) => ({ response: { status, data } })

describe('content form helpers', () => {
  it('prefers my pending value only for keys present in the pending request', () => {
    const form = { published: { headline: 'Cũ', culture: '<p>A</p>' }, pending: { headline: '' } }

    expect(contentValue(form, 'headline')).toBe('')
    expect(contentValue(form, 'culture')).toBe('<p>A</p>')
    expect(contentValue({ published: { culture: 'x' }, pending: null }, 'culture')).toBe('x')
  })

  it('keeps only changed keys, comparing lists and objects by value', () => {
    expect(changedFields(
      { headline: 'Mới', offices: [{ label: 'A' }], social_links: { facebook: '' } },
      { headline: 'Cũ', offices: [{ label: 'A' }], social_links: { facebook: '' } },
    )).toEqual({ headline: 'Mới' })
  })

  it('maps completeness items to their content card', () => {
    expect(completenessCardId('logo')).toBe('company-content-hero')
    expect(completenessCardId('headline')).toBe('company-content-hero')
    expect(completenessCardId('social_links')).toBe('company-content-social_links')
  })

  it('flattens nested 400 errors into form paths and ignores the error code', () => {
    expect(contentFieldErrors({
      code: 'INVALID',
      headline: ['Tối đa 160 ký tự.'],
      offices: [{}, { address_line: ['Bắt buộc.'] }],
      social_links: { facebook: ['Không phải liên kết Facebook.'] },
    })).toEqual([
      { name: ['headline'], errors: ['Tối đa 160 ký tự.'] },
      { name: ['offices', 1, 'address_line'], errors: ['Bắt buộc.'] },
      { name: ['social_links', 'facebook'], errors: ['Không phải liên kết Facebook.'] },
    ])
    expect(contentFieldErrors({ changes: { video_url: 'Không hỗ trợ.' } })).toEqual([{ name: ['video_url'], errors: ['Không hỗ trợ.'] }])
  })

  it('classifies submit failures', () => {
    expect(contentSubmitOutcome(apiError(409, { code: 'COMPANY_UPDATE_IN_REVIEW', detail: 'Đang thẩm định.' })))
      .toEqual({ kind: 'in_review', message: 'Đang thẩm định.' })
    expect(contentSubmitOutcome(apiError(403, { code: 'COMPANY_PAGE_EDIT_FORBIDDEN', detail: 'Không có quyền.' })))
      .toEqual({ kind: 'forbidden', message: 'Không có quyền.' })
    expect(contentSubmitOutcome(apiError(400, { headline: ['Sai.'] }))).toEqual({ kind: 'invalid', fields: [{ name: ['headline'], errors: ['Sai.'] }] })
    expect(contentSubmitOutcome({ mediaFailed: true }).kind).toBe('media')
    expect(contentSubmitOutcome(apiError(500, {})).kind).toBe('failed')
  })
})
