import { describe, expect, it } from 'vitest'
import { formatDocumentTitle, portalSiteTitle } from './document-title'

describe('formatDocumentTitle', () => {
  it('ends every title with the brand of its portal', () => {
    expect(formatDocumentTitle('Tin tuyển dụng', { portal: 'employer', siteName: 'ProCV' }))
      .toBe('Tin tuyển dụng | ProCV cho Nhà tuyển dụng')
    expect(formatDocumentTitle('Quản lý công ty', { portal: 'admin', siteName: 'ProCV' }))
      .toBe('Quản lý công ty | Quản trị ProCV')
    expect(formatDocumentTitle('Việc làm đã lưu', { portal: 'main', siteName: 'Tên website' }))
      .toBe('Việc làm đã lưu | Tên website')
  })

  it('derives the employer and admin brands from the configured site name', () => {
    expect(portalSiteTitle('employer', 'Tên website')).toBe('Tên website cho Nhà tuyển dụng')
    expect(portalSiteTitle('admin', 'Tên website')).toBe('Quản trị Tên website')
  })

  it('replaces another portal suffix instead of duplicating it', () => {
    expect(formatDocumentTitle('Trang chủ | ProCV cho Nhà tuyển dụng', { portal: 'main', siteName: 'ProCV' }))
      .toBe('Trang chủ | ProCV')
  })

  it('shows the brand alone for an empty title and keeps a branded home title as is', () => {
    expect(formatDocumentTitle('', { portal: 'employer', siteName: 'ProCV' })).toBe('ProCV cho Nhà tuyển dụng')
    expect(formatDocumentTitle('ProCV - Việc làm & Tạo CV cùng AI', { portal: 'main', siteName: 'ProCV' }))
      .toBe('ProCV - Việc làm & Tạo CV cùng AI')
  })
})
