import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getSiteSettings } from '../../api/siteService'
import { DEFAULT_SITE_SETTINGS, SiteSettingsContext } from '../../contexts/siteSettingsContext'
import { settingText } from '../../hooks/useSiteSettings'

function mergeSettings(data) {
  if (!data || typeof data !== 'object') return DEFAULT_SITE_SETTINGS
  return { ...DEFAULT_SITE_SETTINGS, ...data }
}

function hexToRgb(hex) {
  const raw = hex.trim().replace('#', '')
  const normalized = raw.length === 3
    ? raw.split('').map((ch) => ch + ch).join('')
    : raw
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return null
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  }
}

function rgbToHex({ r, g, b }) {
  return `#${[r, g, b].map((value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0')).join('')}`
}

function mixWith(color, target, weight) {
  return rgbToHex({
    r: color.r + (target.r - color.r) * weight,
    g: color.g + (target.g - color.g) * weight,
    b: color.b + (target.b - color.b) * weight,
  })
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

const RETRY_DELAYS_MS = [250, 750]

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export default function SiteSettingsProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULT_SITE_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const requestId = useRef(0)

  const loadSettings = useCallback(async () => {
    const currentRequest = ++requestId.current
    setLoading(true)
    setError(null)

    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
      try {
        const data = await getSiteSettings()
        if (currentRequest === requestId.current) setSettings(mergeSettings(data))
        break
      } catch (nextError) {
        if (attempt === RETRY_DELAYS_MS.length) {
          if (currentRequest === requestId.current) setError(nextError)
          break
        }
        await wait(RETRY_DELAYS_MS[attempt])
      }
    }

    if (currentRequest === requestId.current) setLoading(false)
  }, [])

  useEffect(() => {
    loadSettings()
    return () => { requestId.current += 1 }
  }, [loadSettings])

  useEffect(() => {
    const primaryColor = settingText(settings.brand_primary_color, DEFAULT_SITE_SETTINGS.brand_primary_color)
    const rgb = hexToRgb(primaryColor)
    const hoverColor = rgb ? mixWith(rgb, { r: 0, g: 0, b: 0 }, 0.18) : primaryColor
    const softColor = rgb ? mixWith(rgb, { r: 255, g: 255, b: 255 }, 0.9) : '#f0fbf5'

    document.documentElement.style.setProperty('--brand-primary', primaryColor)
    document.documentElement.style.setProperty('--brand-primary-hover', hoverColor)
    document.documentElement.style.setProperty('--brand-primary-soft', softColor)
  }, [settings.brand_primary_color])

  useEffect(() => {
    const faviconUrl = settingText(settings.brand_favicon_url, DEFAULT_SITE_SETTINGS.brand_favicon_url)
    if (!faviconUrl) return
    ensureFaviconLink().href = faviconUrl
  }, [settings.brand_favicon_url])

  const value = useMemo(
    () => ({ settings, loading, error, retry: loadSettings }),
    [settings, loading, error, loadSettings],
  )

  return (
    <SiteSettingsContext.Provider value={value}>
      {children}
    </SiteSettingsContext.Provider>
  )
}
