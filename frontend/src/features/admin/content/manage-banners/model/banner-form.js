import { HOME_HERO_PLACEMENT } from '@/entities/content/banner'
import dayjs from '@/shared/lib/dayjs'
import { m } from '@/shared/config/i18n'

export const SCHEDULE_TAGS = {
  running: { color: 'success', label: () => m.admin_banner_state_running() },
  scheduled: { color: 'processing', label: () => m.admin_banner_state_scheduled() },
  expired: { color: 'default', label: () => m.admin_banner_state_expired() },
  off: { color: 'default', label: () => m.admin_banner_state_off() },
}

export const PLACEMENT_LABELS = {
  home_hero: () => m.admin_banner_placement_home_hero(),
  job_list_inline: () => m.admin_banner_placement_job_list_inline(),
  job_empty: () => m.admin_banner_placement_job_empty(),
  job_detail_sidebar: () => m.admin_banner_placement_job_detail_sidebar(),
  blog_sidebar: () => m.admin_banner_placement_blog_sidebar(),
  blog_inline: () => m.admin_banner_placement_blog_inline(),
}

const TEXT_FIELDS = ['eyebrow', 'title', 'subtitle', 'cta_label', 'cta_url', 'cta_secondary_label', 'cta_secondary_url']

export function emptyBannerValues(placement) {
  return {
    placement,
    kind: placement === HOME_HERO_PLACEMENT ? 'image' : 'promo',
    theme: 'green',
    is_active: true,
    image_path: '',
    image_preview: '',
    company: null,
    schedule: null,
    ...Object.fromEntries(TEXT_FIELDS.map((field) => [field, ''])),
  }
}

export function bannerFormValues(banner) {
  return {
    ...emptyBannerValues(banner.placement),
    ...Object.fromEntries(TEXT_FIELDS.map((field) => [field, banner[field] || ''])),
    placement: banner.placement,
    kind: banner.kind,
    theme: banner.theme,
    is_active: banner.is_active,
    image_path: banner.image_path || '',
    image_preview: banner.image_url || '',
    company: banner.company?.public_id || null,
    schedule: banner.starts_at || banner.ends_at
      ? [banner.starts_at ? dayjs(banner.starts_at) : null, banner.ends_at ? dayjs(banner.ends_at) : null]
      : null,
  }
}

export function bannerPayload(values) {
  const [start, end] = values.schedule || []
  return {
    placement: values.placement,
    kind: values.kind,
    theme: values.theme,
    is_active: values.is_active,
    image_url: values.image_path || '',
    company: values.company || null,
    starts_at: start ? start.toISOString() : null,
    ends_at: end ? end.toISOString() : null,
    ...Object.fromEntries(TEXT_FIELDS.map((field) => [field, (values[field] || '').trim()])),
  }
}

/** Banner giả lập từ giá trị form để xem trước bằng đúng component trang chủ. */
export function previewBanner(values, company) {
  return {
    id: 'preview',
    ...bannerPayload(values),
    image_url: values.image_preview || '',
    company: values.company && company ? company : null,
  }
}

/** Lỗi theo field từ API (DRF) -> danh sách field cho `form.setFields`. */
export function apiFieldErrors(error) {
  const data = error?.response?.data
  if (!data || typeof data !== 'object') return []
  const field = (name) => (name === 'image_url' ? 'image_path' : name === 'starts_at' || name === 'ends_at' ? 'schedule' : name)
  return Object.entries(data)
    .filter(([, messages]) => Array.isArray(messages))
    .map(([name, messages]) => ({ name: field(name), errors: messages.map(String) }))
}
