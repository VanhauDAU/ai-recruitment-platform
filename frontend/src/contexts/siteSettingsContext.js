import { createContext } from 'react'

export const DEFAULT_SITE_SETTINGS = {
  site_name: 'ProCV',
  brand_logo_url: import.meta.env.VITE_SITE_LOGO_URL || '/images/logo/logo-full.png',
  brand_logo_mark_url: import.meta.env.VITE_SITE_LOGO_MARK_URL || '/images/logo/logo-mark.png',
  brand_favicon_url: import.meta.env.VITE_SITE_FAVICON_URL || '/favicon-32.png',
  brand_primary_color: '#00b14f',
  site_tagline: 'Nền tảng việc làm & AI Career Coach',
  footer_logo_url: '',
  footer_description: 'ProCV - Nền tảng việc làm và phát triển sự nghiệp cùng AI dành cho người Việt.',
  footer_copyright: '© 2026 ProCV. All rights reserved.',
  footer_show_link_groups: true,
  footer_show_contact: true,
  footer_show_apps: true,
  footer_show_socials: true,
  footer_company_name: '',
  footer_business_license: '',
  footer_app_store_url: '',
  footer_google_play_url: '',
  footer_qr_code_url: '',
  footer_qr_label: '',
  footer_facebook_url: '',
  footer_linkedin_url: '',
  footer_youtube_url: '',
  footer_tiktok_url: '',
  hotline: '1900 1234',
  support_email: 'support@aicareercoach.vn',
  contact_address: '',
  contact_working_hours: '8:00 - 17:30, Thứ 2 - Thứ 6',
}

export const SiteSettingsContext = createContext({
  settings: DEFAULT_SITE_SETTINGS,
  loading: false,
  error: null,
  retry: () => {},
})
