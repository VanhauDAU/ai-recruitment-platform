import { describe, expect, it } from 'vitest'
import { sanitizeHtml } from './sanitize-html'

describe('sanitizeHtml', () => {
  it('trả rỗng cho input rỗng hoặc chỉ khoảng trắng', () => {
    expect(sanitizeHtml('')).toBe('')
    expect(sanitizeHtml('   ')).toBe('')
    expect(sanitizeHtml(null)).toBe('')
    expect(sanitizeHtml(undefined)).toBe('')
  })

  it('loại bỏ thẻ script và giữ nội dung an toàn', () => {
    const out = sanitizeHtml('<p>Xin chào</p><script>alert(1)</script>')
    expect(out).toContain('<p>Xin chào</p>')
    expect(out).not.toContain('<script')
    expect(out).not.toContain('alert(1)')
  })

  it('loại bỏ event handler và URL javascript:', () => {
    const out = sanitizeHtml('<a href="javascript:alert(1)" onclick="steal()">x</a>')
    expect(out).not.toContain('onclick')
    expect(out).not.toContain('javascript:')
  })

  it('thêm rel chống tabnabbing cho link mở tab mới', () => {
    const out = sanitizeHtml('<a href="https://a.vn" target="_blank">x</a>')
    expect(out).toContain('rel="noopener noreferrer"')
  })

  it('giữ các thẻ định dạng và bảng được phép', () => {
    const out = sanitizeHtml('<h2>Tiêu đề</h2><ul><li>a</li></ul><table><tr><td>1</td></tr></table>')
    expect(out).toContain('<h2>Tiêu đề</h2>')
    expect(out).toContain('<li>a</li>')
    expect(out).toContain('<td>1</td>')
  })

  it('loại CSS nguy hiểm trong style nhưng giữ style thường', () => {
    const out = sanitizeHtml('<p style="color: red; background: url(javascript:alert(1))">x</p>')
    expect(out).toContain('color: red')
    expect(out).not.toContain('javascript:')
  })
})
