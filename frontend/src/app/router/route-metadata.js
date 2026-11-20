import {
  COMPANY_DIRECTORY_PATH,
  COMPANY_SEARCH_PATH,
  isCompanyDetailPath,
} from '@/entities/company/company'
import { employerAppPath, employerMarketingPath } from '@/shared/config/portals'
import { NOT_FOUND_TITLE } from '@/shared/config/document-title'
import { resolveRouteTitle } from './document-title'

const MAIN_PUBLIC_EXACT_PATHS = new Set([
  '/',
  COMPANY_DIRECTORY_PATH,
  '/viec-lam',
  '/jobs',
  '/blog',
  '/chinh-sach-cookie',
])

const EMPLOYER_MARKETING_SEGMENTS = [
  '',
  '/gioi-thieu',
  '/dich-vu',
  '/lien-he',
  '/dieu-khoan-dich-vu',
  '/chinh-sach-quyen-rieng',
]

// Trang chủ không có ở đây: dùng seo_default_description admin cấu hình (khớp SEO shell server).
const ROUTE_DESCRIPTIONS = new Map([
  [COMPANY_DIRECTORY_PATH, 'Khám phá danh sách công ty, tìm hiểu doanh nghiệp và các cơ hội việc làm đang tuyển dụng.'],
  [COMPANY_SEARCH_PATH, 'Tìm kiếm công ty theo tên và khám phá các vị trí đang tuyển dụng.'],
  ['/viec-lam', 'Tìm kiếm việc làm mới nhất theo ngành nghề, địa điểm và kinh nghiệm.'],
  ['/jobs', 'Tìm kiếm việc làm mới nhất theo ngành nghề, địa điểm và kinh nghiệm.'],
  ['/blog', 'Kiến thức tìm việc, viết CV, phỏng vấn và phát triển sự nghiệp.'],
  ['/tro-giup', 'Tìm câu trả lời và hướng dẫn sử dụng ProCV dành cho ứng viên.'],
  ['/mau-cv', 'Khám phá mẫu CV chuyên nghiệp, dễ chỉnh sửa và phù hợp nhiều ngành nghề.'],
])

function normalizePath(pathname) {
  if (!pathname || pathname === '/') return '/'
  return pathname.replace(/\/+$/, '')
}

export function canonicalPathForRoute(pathname) {
  const normalized = normalizePath(pathname)
  if (normalized === COMPANY_SEARCH_PATH) return COMPANY_DIRECTORY_PATH
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
    // Trang công ty tự hạ xuống noindex theo `indexable` của API và query tab/bộ lọc.
    || isCompanyDetailPath(normalized)
    || normalized.startsWith('/viec-lam/')
    || normalized.startsWith('/jobs/')
    || normalized.startsWith('/brand/')
    || normalized.startsWith('/tuyen-dung/')
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
  const knowledgebaseIndexable = (
    normalized === '/tro-giup' || normalized.startsWith('/tro-giup/')
  ) && settings.knowledgebase_public_enabled === true
    && settings.knowledgebase_search_index_enabled === true
  const indexable = (isIndexableRoute(normalized, portal) || knowledgebaseIndexable)
    && title !== NOT_FOUND_TITLE

  return {
    title,
    description: ROUTE_DESCRIPTIONS.get(normalized) || settings.seo_default_description,
    canonicalPath: canonicalPathForRoute(normalized),
    robots: settings.seo_robots_index !== false && indexable
      ? 'index, follow'
      : 'noindex, nofollow',
    // Không có ảnh chia sẻ riêng thì dùng logo, giống SEO shell của server.
    imageUrl: settings.seo_og_image || settings.brand_logo_url,
    pageType: 'website',
    googleSiteVerification: settings.seo_google_site_verification,
  }
}
