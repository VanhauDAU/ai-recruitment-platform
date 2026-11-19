import { m } from '@/shared/config/i18n'
import { getCurrentPortal } from './portals'

export const DEFAULT_SITE_TITLE = 'ProCV'
export const NOT_FOUND_TITLE = m.title_not_found()

const TITLE_SEPARATOR = ' | '
const PORTALS = ['employer', 'admin', 'main']

/**
 * Thương hiệu đứng cuối tiêu đề theo cổng — như các trang tuyển dụng lớn tách
 * cổng ứng viên và cổng doanh nghiệp — để tab trình duyệt cho biết đang ở đâu.
 */
export function portalSiteTitle(portal, siteName = DEFAULT_SITE_TITLE) {
  const name = siteName || DEFAULT_SITE_TITLE
  if (portal === 'employer') return m.title_employer_suffix({ name })
  if (portal === 'admin') return m.title_admin_suffix({ name })
  return name
}

function removeKnownSuffix(value, suffixes) {
  for (const suffix of suffixes) {
    if (value === suffix) return ''
    const marker = `${TITLE_SEPARATOR}${suffix}`
    if (value.endsWith(marker)) return value.slice(0, -marker.length).trim()
  }
  return value
}

export function formatDocumentTitle(title, { portal = getCurrentPortal(), siteName = DEFAULT_SITE_TITLE } = {}) {
  const suffix = portalSiteTitle(portal, siteName)
  const knownSuffixes = PORTALS.map((item) => portalSiteTitle(item, siteName))
  const value = removeKnownSuffix(String(title || '').trim(), knownSuffixes)
  if (!value || value === suffix) return suffix
  // Tiêu đề trang chủ cấu hình dạng "ProCV - Khẩu hiệu" đã mang thương hiệu ở đầu.
  if (value.startsWith(`${suffix} - `)) return value
  return `${value}${TITLE_SEPARATOR}${suffix}`
}
