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

// Quầng sáng góc phủ lên mọi tông cho cảm giác chiều sâu.
const GLOW = 'radial-gradient(circle at 88% 12%, rgba(255,255,255,0.28), transparent 42%), '
  + 'radial-gradient(circle at 8% 110%, rgba(255,255,255,0.16), transparent 40%)'

function gradient(stops) {
  return `${GLOW}, linear-gradient(135deg, ${stops})`
}

// Khớp Banner.Theme ở backend. Gradient đặt bằng inline style (không thêm utility
// Tailwind vào CSS khởi tạo); `accent` là màu chữ của nút trắng.
export const BANNER_THEMES = {
  green: {
    label: () => m.banner_theme_green(),
    background: gradient('var(--brand-primary) 0%, var(--brand-primary-hover) 60%, #064e3b 100%'),
    accent: 'var(--brand-primary-hover)',
  },
  blue: {
    label: () => m.banner_theme_blue(),
    background: gradient('#0ea5e9 0%, #2563eb 50%, #312e81 100%'),
    accent: '#1d4ed8',
  },
  orange: {
    label: () => m.banner_theme_orange(),
    background: gradient('#f59e0b 0%, #f97316 45%, #e11d48 100%'),
    accent: '#c2410c',
  },
  violet: {
    label: () => m.banner_theme_violet(),
    background: gradient('#8b5cf6 0%, #7c3aed 45%, #c026d3 100%'),
    accent: '#6d28d9',
  },
  teal: {
    label: () => m.banner_theme_teal(),
    background: gradient('#22d3ee 0%, #0d9488 50%, #065f46 100%'),
    accent: '#0f766e',
  },
  rose: {
    label: () => m.banner_theme_rose(),
    background: gradient('#fb7185 0%, #e11d48 50%, #9d174d 100%'),
    accent: '#be123c',
  },
  aurora: {
    label: () => m.banner_theme_aurora(),
    background: gradient('#6366f1 0%, #2563eb 45%, #10b981 100%'),
    accent: '#4338ca',
  },
  midnight: {
    label: () => m.banner_theme_midnight(),
    background: gradient('#0f172a 0%, #1e293b 50%, #312e81 100%'),
    accent: '#1e293b',
  },
}

export const BANNER_THEME_KEYS = Object.keys(BANNER_THEMES)

export function bannerTheme(theme) {
  return BANNER_THEMES[theme] || BANNER_THEMES.green
}

/** Style nền cho khối banner theo tông màu. */
export function bannerBackgroundStyle(theme) {
  return { backgroundImage: bannerTheme(theme).background }
}

/** Đổi đường dẫn cũ (/jobs, /register, /sign-up) nhập trong admin sang route tiếng Việt hiện hành. */
export function normalizePublicUrl(url = '') {
  if (url === '/jobs') return '/viec-lam'
  if (url.startsWith('/jobs?')) return url.replace('/jobs?', '/viec-lam?')
  if (url.startsWith('/jobs/')) return url.replace('/jobs/', '/viec-lam/')
  if (url === '/register' || url === '/sign-up') return '/dang-ky'
  return url
}

export function isExternalUrl(url = '') {
  return /^https?:\/\//i.test(url)
}
