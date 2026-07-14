export const CATALOG_LOCALES = [
  { locale: 'vi-VN', path: '/mau-cv', label: 'Tiếng Việt', shortLabel: 'tiếng Việt', flag: '🇻🇳' },
  { locale: 'en-US', path: '/mau-cv-tieng-anh', label: 'Tiếng Anh', shortLabel: 'tiếng Anh', flag: '🇬🇧' },
  { locale: 'ja-JP', path: '/mau-cv-tieng-nhat', label: 'Tiếng Nhật', shortLabel: 'tiếng Nhật', flag: '🇯🇵' },
  { locale: 'zh-CN', path: '/mau-cv-tieng-trung', label: 'Tiếng Trung', shortLabel: 'tiếng Trung', flag: '🇨🇳' },
]

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

export function templateDetailPath(locale, slug) {
  const base = catalogPathForLocale(locale)
  return `${base}/chi-tiet/${slug}`
}

/**
 * Build detail URL từ basePath đã biết (dùng trong component).
 */
export function buildDetailPath(basePath, slug) {
  return `${basePath}/chi-tiet/${slug}`
}
