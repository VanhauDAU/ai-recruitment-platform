import { sanitizeHtml } from '@/shared/lib/sanitize-html'

function slugifyHeading(text, used) {
  const base = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'muc'
  let id = base
  let index = 2
  while (used.has(id)) { id = `${base}-${index}`; index += 1 }
  used.add(id)
  return id
}

export function processBlogContent(html) {
  const clean = sanitizeHtml(html)
  if (!clean) return { html: '', toc: [] }

  const doc = new DOMParser().parseFromString(clean, 'text/html')
  const usedIds = new Set()
  const toc = []
  for (const element of doc.body.querySelectorAll('h2, h3')) {
    const text = element.textContent.trim()
    if (!text) continue
    const id = slugifyHeading(text, usedIds)
    element.setAttribute('id', id)
    toc.push({ id, text, level: element.tagName === 'H2' ? 2 : 3 })
  }
  return { html: doc.body.innerHTML, toc }
}
