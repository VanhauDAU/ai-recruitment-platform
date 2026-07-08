import { createContext } from 'react'

export const DEFAULT_SITE_SETTINGS = {
  site_name: 'ProCV',
  brand_logo_url: import.meta.env.VITE_SITE_LOGO_URL || '/images/logo/aicareer-logo.svg',
  ProCV: import.meta.env.VITE_SITE_LOGO_MARK_URL || '/favicon.svg',
  brand_favicon_url: import.meta.env.VITE_SITE_FAVICON_URL || '/favicon.svg',
  brand_primary_color: '#00b14f',
}

export const SiteSettingsContext = createContext({
  settings: DEFAULT_SITE_SETTINGS,
  loading: false,
  error: null,
})
