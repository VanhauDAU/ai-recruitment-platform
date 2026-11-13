import { CV_LANGUAGES } from '@/entities/cv-template'

// Đường dẫn kho mẫu CV theo ngôn ngữ (tiếng Việt, tiếng Anh). Path Nhật/Trung
// và /mau-cv/ngon-ngu/:locale cũ được redirect ở router và SEO shell backend.
const CATALOG_PATHS = { 'vi-VN': '/mau-cv', 'en-US': '/mau-cv-tieng-anh' }

export const CATALOG_LOCALES = CV_LANGUAGES.map((language) => ({
  locale: language.code,
  path: CATALOG_PATHS[language.code],
  label: language.label,
  shortLabel: language.inlineLabel,
  flag: language.flag,
}))

export function catalogLocaleFromPath(pathname) {
  const match = [...CATALOG_LOCALES]
    .sort((a, b) => b.path.length - a.path.length)
    .find((item) => pathname === item.path || pathname.startsWith(`${item.path}/`))
  return match || CATALOG_LOCALES[0]
}

export function catalogPathForLocale(locale) {
  return (CATALOG_LOCALES.find((item) => item.locale === locale) || CATALOG_LOCALES[0]).path
}

/**
 * Trả về URL catalog có kèm category slug, ví dụ:
 *   /mau-cv-tieng-anh/mau-it
 * Nếu không có category thì trả về base path (vd: /mau-cv-tieng-anh).
 */
export function catalogPathForCategory(basePath, categorySlug) {
  if (!categorySlug) return basePath
  return `${basePath}/${categorySlug}`
}

/**
 * Đọc category slug từ pathname (phần sau basePath).
 * Ví dụ: /mau-cv-tieng-anh/mau-it → 'mau-it'
 */
export function catalogCategoryFromPath(pathname, basePath) {
  if (!pathname.startsWith(`${basePath}/`)) return null
  const rest = pathname.slice(basePath.length + 1)
  const firstSegment = rest.split('/')[0] || null
  // Bỏ qua segment dành riêng cho detail page
  if (firstSegment === 'chi-tiet') return null
  return firstSegment
}
