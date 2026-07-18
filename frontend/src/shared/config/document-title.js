import { getCurrentPortal } from './portals'

export const EMPLOYER_SITE_TITLE = 'Smart Recruitment Platform'
export const DEFAULT_SITE_TITLE = 'ProCV'

const TITLE_SEPARATOR = ' | '

function removeKnownSuffix(value, suffixes) {
  for (const suffix of suffixes) {
    if (value === suffix) return ''
    const marker = `${TITLE_SEPARATOR}${suffix}`
    if (value.endsWith(marker)) return value.slice(0, -marker.length).trim()
  }
  return value
}

export function formatDocumentTitle(title, { portal = getCurrentPortal(), siteName = DEFAULT_SITE_TITLE } = {}) {
  const suffix = portal === 'employer' ? EMPLOYER_SITE_TITLE : (siteName || DEFAULT_SITE_TITLE)
  const value = removeKnownSuffix(String(title || '').trim(), [EMPLOYER_SITE_TITLE, DEFAULT_SITE_TITLE, suffix])
  if (!value || value === suffix) return suffix
  return `${value}${TITLE_SEPARATOR}${suffix}`
}

export function setDocumentTitle(title, options) {
  if (typeof document !== 'undefined') {
    document.title = formatDocumentTitle(title, options)
  }
}
