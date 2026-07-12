import { useEffect, useMemo } from 'react'

const ALLOWED_TAGS = new Set([
  'a', 'b', 'blockquote', 'br', 'code', 'div', 'em', 'figure', 'figcaption', 'h2', 'h3',
  'h4', 'hr', 'img', 'li', 'ol', 'p', 'pre', 'span', 'strong', 'table', 'tbody', 'td',
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

function slugifyHeading(text, used) {
  const base = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'muc'
  let id = base
  let i = 2
  while (used.has(id)) { id = `${base}-${i}`; i += 1 }
  used.add(id)
  return id
}

// Vệ sinh HTML từ rich-text editor (loại script/handler/URL nguy hiểm) và gắn
// id vào h2/h3 để mục lục có thể cuộn tới. Trả về { html, toc }.
function processContent(html) {
  if (typeof window === 'undefined' || !html?.trim()) return { html: '', toc: [] }
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const usedIds = new Set()
  const toc = []

  for (const element of [...doc.body.querySelectorAll('*')]) {
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
    if (tag === 'h2' || tag === 'h3') {
      const text = element.textContent.trim()
      if (text) {
        const id = slugifyHeading(text, usedIds)
        element.setAttribute('id', id)
        toc.push({ id, text, level: tag === 'h2' ? 2 : 3 })
      }
    }
  }
  return { html: doc.body.innerHTML, toc }
}

export default function BlogContent({ html, onToc }) {
  const { html: safeHtml, toc } = useMemo(() => processContent(html), [html])

  useEffect(() => { onToc?.(toc) }, [toc, onToc])

  if (!safeHtml) return null
  return (
    <div
      className="blog-rich-content overflow-x-auto text-sm leading-7 text-slate-700 sm:text-[15px] [&_a]:break-words [&_a]:text-[var(--brand-primary)] [&_a]:underline [&_blockquote]:my-4 [&_blockquote]:border-l-4 [&_blockquote]:border-emerald-200 [&_blockquote]:pl-3 [&_blockquote]:text-slate-500 sm:[&_blockquote]:pl-4 [&_h2]:mt-7 [&_h2]:scroll-mt-28 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-slate-900 sm:[&_h2]:mt-8 sm:[&_h2]:text-xl [&_h3]:mt-5 [&_h3]:scroll-mt-28 [&_h3]:text-base [&_h3]:font-bold [&_h3]:text-slate-800 sm:[&_h3]:mt-6 sm:[&_h3]:text-lg [&_img]:my-4 [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-lg sm:[&_img]:my-5 sm:[&_img]:rounded-xl [&_li]:mb-1 [&_li]:ml-4 sm:[&_li]:ml-5 [&_ol]:my-4 [&_ol]:list-decimal [&_p]:mb-4 [&_table]:my-5 [&_table]:min-w-[560px] [&_table]:border-collapse [&_td]:border [&_td]:border-slate-200 [&_td]:p-2 [&_th]:border [&_th]:border-slate-200 [&_th]:bg-slate-50 [&_th]:p-2 [&_ul]:my-4 [&_ul]:list-disc"
      dangerouslySetInnerHTML={{ __html: safeHtml }}
    />
  )
}
