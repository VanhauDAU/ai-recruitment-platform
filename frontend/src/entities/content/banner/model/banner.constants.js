import { m } from '@/shared/config/i18n'

// Khớp Banner.Kind / Banner.Placement / Banner.Theme ở backend.
export const BANNER_KINDS = ['image', 'promo', 'company', 'ai']
export const HOME_HERO_PLACEMENT = 'home_hero'
export const BANNER_PLACEMENTS = [
  HOME_HERO_PLACEMENT,
  'job_list_inline',
  'job_empty',
  'job_detail_sidebar',
  'blog_sidebar',
  'blog_inline',
]

export const BANNER_KIND_LABELS = {
  image: () => m.banner_kind_image(),
  promo: () => m.banner_kind_promo(),
  company: () => m.banner_kind_company(),
  ai: () => m.banner_kind_ai(),
}

// Lớp nút có `!` vì nút là thẻ <a>: reset của antd đè nền/chữ của link.
export const BANNER_THEMES = {
  green: {
    gradient: 'from-[var(--brand-primary)] to-[var(--brand-primary-hover)]',
    text: 'text-green-50',
    eyebrow: 'text-green-100',
    button: '!text-[var(--brand-primary-hover)] hover:!bg-green-50',
  },
  blue: {
    gradient: 'from-blue-600 to-blue-800',
    text: 'text-blue-50',
    eyebrow: 'text-blue-100',
    button: '!text-blue-700 hover:!bg-blue-50',
  },
  orange: {
    gradient: 'from-orange-500 to-pink-600',
    text: 'text-orange-50',
    eyebrow: 'text-orange-100',
    button: '!text-orange-700 hover:!bg-orange-50',
  },
}

export function bannerTheme(theme) {
  return BANNER_THEMES[theme] || BANNER_THEMES.green
}

/** Đổi đường dẫn cũ (/jobs, /register) nhập trong admin sang route tiếng Việt hiện hành. */
export function normalizePublicUrl(url = '') {
  if (url === '/jobs') return '/viec-lam'
  if (url.startsWith('/jobs?')) return url.replace('/jobs?', '/viec-lam?')
  if (url.startsWith('/jobs/')) return url.replace('/jobs/', '/viec-lam/')
  if (url === '/register') return '/sign-up'
  return url
}

export function isExternalUrl(url = '') {
  return /^https?:\/\//i.test(url)
}
