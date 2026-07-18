import { describe, expect, it } from 'vitest'
import { formatDocumentTitle } from './document-title'

describe('formatDocumentTitle', () => {
  it('uses the employer platform title only for employer pages', () => {
    expect(formatDocumentTitle('Thay đổi mật khẩu', { portal: 'employer' }))
      .toBe('Thay đổi mật khẩu | Smart Recruitment Platform')
  })

  it('uses the configured candidate site name', () => {
    expect(formatDocumentTitle('Trang chủ', { portal: 'main', siteName: 'Tên website' }))
      .toBe('Trang chủ | Tên website')
  })

  it('replaces an old title suffix instead of duplicating it', () => {
    expect(formatDocumentTitle('Trang chủ | Smart Recruitment Platform', { portal: 'main', siteName: 'ProCV' }))
      .toBe('Trang chủ | ProCV')
  })
})
