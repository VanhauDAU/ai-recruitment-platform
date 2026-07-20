import DOMPurify from 'dompurify'

// Vệ sinh HTML từ rich-text editor trước khi render bằng dangerouslySetInnerHTML.
// Dùng DOMPurify (chống cả mutation-XSS) thay cho bộ lọc tự viết để mọi bề mặt
// rich-text (tin tuyển dụng, blog, mô tả công ty) chia sẻ đúng một chính sách.
const ALLOWED_TAGS = [
  'a', 'b', 'blockquote', 'br', 'code', 'div', 'em', 'figure', 'figcaption',
  'h2', 'h3', 'h4', 'hr', 'img', 'li', 'ol', 'p', 'pre', 'span', 'strong',
  'table', 'tbody', 'td', 'th', 'thead', 'tr', 'u', 'ul',
]
// `id` không nằm trong danh sách: heading id cho mục lục được gắn ở bước xử lý
// riêng sau khi đã sanitize. `style` được lọc thêm bằng allowlist ở hook bên dưới
// vì lớp sanitize CSS mặc định của DOMPurify không đủ chặt trên mọi môi trường.
const ALLOWED_ATTR = ['href', 'src', 'alt', 'colspan', 'target', 'style']
const ALLOWED_STYLES = new Set([
  'background-color', 'color', 'font-family', 'font-size', 'font-style', 'font-weight',
  'line-height', 'list-style-type', 'margin-left', 'text-align', 'text-decoration',
])

// Chỉ giữ khai báo CSS thuộc allowlist và không chứa cấu trúc nguy hiểm.
function safeStyle(styleText) {
  return styleText
    .split(';')
    .map((rule) => rule.split(':').map((part) => part.trim()))
    .filter(([property, value]) => (
      ALLOWED_STYLES.has(property) && value && !/url\(|expression|@import|javascript:/i.test(value)
    ))
    .map(([property, value]) => `${property}: ${value}`)
    .join('; ')
}

let hookRegistered = false

function ensureHook() {
  if (hookRegistered) return
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    // Link mở tab mới phải có rel chống reverse-tabnabbing.
    if (node.tagName === 'A' && node.getAttribute('target') === '_blank') {
      node.setAttribute('rel', 'noopener noreferrer')
    }
    // Ép style qua allowlist thay vì tin vào bộ lọc CSS ngầm.
    if (node.hasAttribute?.('style')) {
      const style = safeStyle(node.getAttribute('style') || '')
      if (style) node.setAttribute('style', style)
      else node.removeAttribute('style')
    }
  })
  hookRegistered = true
}

export function sanitizeHtml(html) {
  if (typeof window === 'undefined' || !html?.trim()) return ''
  ensureHook()
  return DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR })
}
