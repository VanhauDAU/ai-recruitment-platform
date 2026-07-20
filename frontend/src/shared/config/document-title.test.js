import { describe, expect, it } from 'vitest'
import { EMPLOYER_SITE_TITLE, formatDocumentTitle } from './document-title'

describe('formatDocumentTitle', () => {
  it('uses the employer platform title only for employer pages', () => {
    expect(formatDocumentTitle('Thay đổi mật khẩu', { portal: 'employer' }))
      .toBe(`Thay đổi mật khẩu | ${EMPLOYER_SITE_TITLE}`)
  })

  it('uses the configured candidate site name', () => {
    expect(formatDocumentTitle('Trang chủ', { portal: 'main', siteName: 'Tên website' }))
      .toBe('Trang chủ | Tên website')
  })

  it('replaces the employer suffix instead of duplicating it when switching portal', () => {
    expect(formatDocumentTitle(`Trang chủ | ${EMPLOYER_SITE_TITLE}`, { portal: 'main', siteName: 'ProCV' }))
      .toBe('Trang chủ | ProCV')
  })
})
