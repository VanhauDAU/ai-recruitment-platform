import { createContext } from 'react'

export const DEFAULT_SITE_SETTINGS = {
  site_name: 'ProCV',
  brand_logo_url: import.meta.env.VITE_SITE_LOGO_URL || '/images/logo/logo_proCV_2000_2000.png',
  brand_logo_mark_url: import.meta.env.VITE_SITE_LOGO_MARK_URL || '/images/logo/logo_proCV_2000_2000.png',
  brand_favicon_url: import.meta.env.VITE_SITE_FAVICON_URL || '/images/logo/logo_proCV_2000_2000.png',
  brand_primary_color: '#00b14f',
}

export const SiteSettingsContext = createContext({
  settings: DEFAULT_SITE_SETTINGS,
  loading: false,
  error: null,
})
