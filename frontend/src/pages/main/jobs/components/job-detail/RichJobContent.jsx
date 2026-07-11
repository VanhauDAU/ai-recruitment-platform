import { useMemo } from 'react'

const ALLOWED_TAGS = new Set([
  'a', 'b', 'blockquote', 'br', 'code', 'div', 'em', 'h2', 'h3', 'h4', 'hr',
  'img', 'li', 'ol', 'p', 'pre', 'span', 'strong', 'table', 'tbody', 'td',
  'th', 'thead', 'tr', 'u', 'ul',
])
const ALLOWED_STYLES = new Set([
  'background-color', 'color', 'font-family', 'font-size', 'font-style', 'font-weight',
  'line-height', 'list-style-type', 'margin-left', 'text-align', 'text-decoration',
])

function safeUrl(value, { image = false } = {}) {
  try {
    const url = new URL(value, window.location.origin)
    if (image) return ['http:', 'https:'].includes(url.protocol) ? url.href : ''
    return ['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol) ? url.href : ''
  } catch {
    return ''
  }
}

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

// Nội dung tin có thể được nhập từ rich-text editor. Chỉ giữ lại tập thẻ và
// style hiển thị cần thiết; loại bỏ script, event handler và URL nguy hiểm.
function sanitizeHtml(html) {
  if (typeof window === 'undefined' || !html?.trim()) return ''
  const document = new DOMParser().parseFromString(html, 'text/html')
  const elements = [...document.body.querySelectorAll('*')]

  for (const element of elements) {
    const tag = element.tagName.toLowerCase()
    if (!ALLOWED_TAGS.has(tag)) {
      element.replaceWith(...element.childNodes)
      continue
    }

    for (const attribute of [...element.attributes]) {
      const name = attribute.name.toLowerCase()
      const value = attribute.value.trim()
      if (name.startsWith('on')) {
        element.removeAttribute(attribute.name)
      } else if (name === 'style') {
        const style = safeStyle(value)
        if (style) element.setAttribute('style', style)
        else element.removeAttribute('style')
      } else if (tag === 'a' && name === 'href') {
        const url = safeUrl(value)
        if (url) element.setAttribute('href', url)
        else element.removeAttribute('href')
      } else if (tag === 'img' && name === 'src') {
        const url = safeUrl(value, { image: true })
        if (url) element.setAttribute('src', url)
        else element.remove()
      } else if (!['alt', 'colspan', 'href', 'src', 'target'].includes(name)) {
        element.removeAttribute(attribute.name)
      }
    }

    if (tag === 'a' && element.getAttribute('target') === '_blank') {
      element.setAttribute('rel', 'noopener noreferrer')
    }
  }

  return document.body.innerHTML
}

export default function RichJobContent({ html }) {
  const safeHtml = useMemo(() => sanitizeHtml(html), [html])
  if (!safeHtml) return null
  if (!/<\/?[a-z][\s\S]*>/i.test(html)) {
    return <p className="whitespace-pre-line text-sm leading-6 text-slate-600">{html}</p>
  }
  return (
    <div
      className="job-rich-content text-sm leading-6 text-slate-600 [&_a]:text-[var(--brand-primary)] [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-emerald-200 [&_blockquote]:pl-4 [&_h2]:mt-5 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-slate-800 [&_h3]:mt-4 [&_h3]:font-bold [&_h3]:text-slate-800 [&_img]:my-4 [&_img]:max-w-full [&_img]:rounded-xl [&_li]:ml-5 [&_li]:pl-1 [&_ol]:my-3 [&_ol]:list-decimal [&_p]:mb-3 [&_table]:my-4 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-slate-200 [&_td]:p-2 [&_th]:border [&_th]:border-slate-200 [&_th]:bg-slate-50 [&_th]:p-2 [&_ul]:my-3 [&_ul]:list-disc"
      dangerouslySetInnerHTML={{ __html: safeHtml }}
    />
  )
}
