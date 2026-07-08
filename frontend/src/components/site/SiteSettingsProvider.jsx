import { useEffect, useMemo, useState } from 'react'
import { getSiteSettings } from '../../api/siteService'
import { DEFAULT_SITE_SETTINGS, SiteSettingsContext } from '../../contexts/siteSettingsContext'

function mergeSettings(data) {
  if (!data || typeof data !== 'object') return DEFAULT_SITE_SETTINGS
  return { ...DEFAULT_SITE_SETTINGS, ...data }
}

function settingText(value, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function ensureFaviconLink() {
  let link = document.querySelector('link[rel="icon"]')
  if (!link) {
    link = document.createElement('link')
    link.rel = 'icon'
    document.head.appendChild(link)
  }
  return link
}

export default function SiteSettingsProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULT_SITE_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let ignore = false

    getSiteSettings()
      .then((data) => {
        if (!ignore) setSettings(mergeSettings(data))
      })
      .catch((err) => {
        if (!ignore) setError(err)
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })

    return () => {
      ignore = true
    }
  }, [])

  useEffect(() => {
    const primaryColor = settingText(settings.brand_primary_color, DEFAULT_SITE_SETTINGS.brand_primary_color)
    document.documentElement.style.setProperty('--brand-primary', primaryColor)
  }, [settings.brand_primary_color])

  useEffect(() => {
    const faviconUrl = settingText(settings.brand_favicon_url, DEFAULT_SITE_SETTINGS.brand_favicon_url)
    if (!faviconUrl) return
    ensureFaviconLink().href = faviconUrl
  }, [settings.brand_favicon_url])

  const value = useMemo(() => ({ settings, loading, error }), [settings, loading, error])

  return (
    <SiteSettingsContext.Provider value={value}>
      {children}
    </SiteSettingsContext.Provider>
  )
}
