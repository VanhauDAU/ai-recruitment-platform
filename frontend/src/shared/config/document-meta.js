import { formatDocumentTitle } from './document-title'

function ensureElement(selector, tagName, attributes) {
  let element = document.head.querySelector(selector)
  if (!element) {
    element = document.createElement(tagName)
    document.head.appendChild(element)
  }
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value))
  element.setAttribute('data-seo-managed', 'client')
  return element
}

function setMeta(selector, attributes, content) {
  const normalized = String(content || '').trim()
  const existing = document.head.querySelector(selector)
  if (!normalized) {
    if (existing?.hasAttribute('data-seo-managed')) existing.remove()
    return
  }
  ensureElement(selector, 'meta', attributes).setAttribute('content', normalized)
}

function absoluteUrl(value) {
  if (!value || typeof window === 'undefined') return ''
  try {
    return new URL(value, window.location.origin).href
  } catch {
    return ''
  }
}

function safeJson(value) {
  return JSON.stringify(value)
    .replaceAll('&', '\\u0026')
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e')
    .replaceAll('\u2028', '\\u2028')
    .replaceAll('\u2029', '\\u2029')
}

function truncateDescription(value, limit = 160) {
  const normalized = String(value || '').replace(/\s+/g, ' ').trim()
  if (normalized.length <= limit) return normalized
  return `${normalized.slice(0, limit - 1).replace(/[\s,.;:-]+$/, '')}…`
}

export function applyDocumentMetadata(metadata, titleOptions) {
  if (typeof document === 'undefined' || !metadata) return

  const title = formatDocumentTitle(metadata.title, titleOptions)
  const description = truncateDescription(metadata.description)
  const canonicalUrl = absoluteUrl(metadata.canonicalUrl || metadata.canonicalPath)
  const imageUrl = absoluteUrl(metadata.imageUrl)
  const robots = metadata.robots || 'noindex, nofollow'
  const pageType = metadata.pageType || 'website'
  const siteName = titleOptions?.siteName || 'ProCV'

  document.documentElement.lang = metadata.language || 'vi'
  document.title = title
  setMeta('meta[name="description"]', { name: 'description' }, description)
  setMeta('meta[name="robots"]', { name: 'robots' }, robots)
  setMeta('meta[property="og:locale"]', { property: 'og:locale' }, 'vi_VN')
  setMeta('meta[property="og:type"]', { property: 'og:type' }, pageType)
  setMeta('meta[property="og:site_name"]', { property: 'og:site_name' }, siteName)
  setMeta('meta[property="og:title"]', { property: 'og:title' }, title)
  setMeta('meta[property="og:description"]', { property: 'og:description' }, description)
  setMeta('meta[property="og:url"]', { property: 'og:url' }, canonicalUrl)
  setMeta('meta[property="og:image"]', { property: 'og:image' }, imageUrl)
  setMeta(
    'meta[name="twitter:card"]',
    { name: 'twitter:card' },
    imageUrl ? 'summary_large_image' : 'summary',
  )
  setMeta('meta[name="twitter:title"]', { name: 'twitter:title' }, title)
  setMeta('meta[name="twitter:description"]', { name: 'twitter:description' }, description)
  setMeta('meta[name="twitter:image"]', { name: 'twitter:image' }, imageUrl)
  setMeta(
    'meta[name="google-site-verification"]',
    { name: 'google-site-verification' },
    metadata.googleSiteVerification,
  )

  const canonical = document.head.querySelector('link[rel="canonical"]')
  if (canonicalUrl) {
    ensureElement('link[rel="canonical"]', 'link', { rel: 'canonical' }).href = canonicalUrl
  } else if (canonical?.hasAttribute('data-seo-managed')) {
    canonical.remove()
  }

  document.head
    .querySelectorAll('script[type="application/ld+json"][data-seo-managed]')
    .forEach((element) => element.remove())
  if (metadata.structuredData) {
    const script = document.createElement('script')
    script.type = 'application/ld+json'
    script.setAttribute('data-seo-managed', 'client')
    script.textContent = safeJson(metadata.structuredData)
    document.head.appendChild(script)
  }
}

export function setDocumentMetaDescription(value) {
  if (typeof document === 'undefined') return () => {}
  const previous = document.head.querySelector('meta[name="description"]')?.content || ''
  setMeta('meta[name="description"]', { name: 'description' }, value)
  return () => setMeta('meta[name="description"]', { name: 'description' }, previous)
}
