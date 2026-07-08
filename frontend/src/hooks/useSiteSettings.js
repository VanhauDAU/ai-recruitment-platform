import { useContext } from 'react'
import { DEFAULT_SITE_SETTINGS, SiteSettingsContext } from '../contexts/siteSettingsContext'

export function settingText(value, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

export function useSiteSettings() {
  const context = useContext(SiteSettingsContext)
  const settings = context?.settings || DEFAULT_SITE_SETTINGS
  const siteName = settingText(settings.site_name, DEFAULT_SITE_SETTINGS.site_name)

  return {
    ...context,
    settings,
    siteName,
  }
}

export function useSiteSetting(key, fallback = '') {
  const { settings } = useSiteSettings()
  return settingText(settings[key], fallback)
}
