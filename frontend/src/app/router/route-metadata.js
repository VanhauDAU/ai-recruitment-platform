import { employerAppPath, employerMarketingPath } from '@/shared/config/portals'
import { resolveRouteTitle } from './document-title'

const MAIN_PUBLIC_EXACT_PATHS = new Set([
  '/',
  '/viec-lam',
  '/jobs',
  '/blog',
  '/chinh-sach-cookie',
])

const EMPLOYER_MARKETING_SEGMENTS = [
  '',
  '/gioi-thieu',
  '/dich-vu',
  '/bao-gia',
  '/lien-he',
  '/dieu-khoan-dich-vu',
  '/chinh-sach-quyen-rieng',
]

const ROUTE_DESCRIPTIONS = new Map([
  ['/', 'Tìm việc làm, tạo CV chuyên nghiệp và phát triển sự nghiệp cùng AI.'],
  ['/viec-lam', 'Tìm kiếm việc làm mới nhất theo ngành nghề, địa điểm và kinh nghiệm.'],
  ['/jobs', 'Tìm kiếm việc làm mới nhất theo ngành nghề, địa điểm và kinh nghiệm.'],
  ['/blog', 'Kiến thức tìm việc, viết CV, phỏng vấn và phát triển sự nghiệp.'],
  ['/mau-cv', 'Khám phá mẫu CV chuyên nghiệp, dễ chỉnh sửa và phù hợp nhiều ngành nghề.'],
])

function normalizePath(pathname) {
  if (!pathname || pathname === '/') return '/'
  return pathname.replace(/\/+$/, '')
}

export function canonicalPathForRoute(pathname) {
  const normalized = normalizePath(pathname)
  if (normalized === '/jobs') return '/viec-lam'
  if (normalized.startsWith('/jobs/')) return `/viec-lam/${normalized.slice('/jobs/'.length)}`
  if (normalized === '/cv-templates') return '/mau-cv'
  if (normalized.startsWith('/cv-templates/')) {
    return `/mau-cv/chi-tiet/${normalized.slice('/cv-templates/'.length)}`
  }
  const brandMatch = normalized.match(/^\/brand\/[^/]+\/tuyen-dung\/([^/]+)$/)
  if (brandMatch) return `/viec-lam/${brandMatch[1]}`
  return normalized
}

export function isIndexableRoute(pathname, portal) {
  const normalized = normalizePath(pathname)
  if (portal === 'admin') return false
  if (portal === 'employer') {
    if (normalized === employerAppPath('') || normalized.startsWith(`${employerAppPath('')}/`)) {
      return false
    }
    return EMPLOYER_MARKETING_SEGMENTS.some(
      (segment) => normalized === normalizePath(employerMarketingPath(segment)),
    )
  }
  return (
    MAIN_PUBLIC_EXACT_PATHS.has(normalized)
    || normalized.startsWith('/viec-lam/')
    || normalized.startsWith('/jobs/')
    || normalized.startsWith('/brand/')
    || normalized.startsWith('/blog/')
    || normalized.startsWith('/mau-cv')
    || normalized.startsWith('/cv-templates')
  )
}

export function resolveRouteMetadata({ pathname, portal, settings }) {
  const normalized = normalizePath(pathname)
  const title = normalized === '/'
    ? settings.seo_default_title
    : resolveRouteTitle(normalized)
  const indexable = isIndexableRoute(normalized, portal) && title !== 'Trang không tồn tại'

  return {
    title,
    description: ROUTE_DESCRIPTIONS.get(normalized) || settings.seo_default_description,
    canonicalPath: canonicalPathForRoute(normalized),
    robots: settings.seo_robots_index !== false && indexable
      ? 'index, follow'
      : 'noindex, nofollow',
    imageUrl: settings.seo_og_image,
    pageType: 'website',
    googleSiteVerification: settings.seo_google_site_verification,
  }
}
