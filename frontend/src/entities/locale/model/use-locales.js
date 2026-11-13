import { useEffect, useState } from 'react'
import { getLocales } from '../api/locale.api'

export const FALLBACK_LOCALES = [
  { code: 'vi-VN', label_vi: 'Tiếng Việt', native_name: 'Tiếng Việt', flag_emoji: '🇻🇳', catalog_path: 'mau-cv', is_default: true, is_active: true, sort_order: 0 },
  { code: 'en-US', label_vi: 'Tiếng Anh', native_name: 'English', flag_emoji: '🇬🇧', catalog_path: 'mau-cv-tieng-anh', is_default: false, is_active: true, sort_order: 10 },
]

export function useLocales() {
  const [locales, setLocales] = useState(FALLBACK_LOCALES)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let active = true
    getLocales()
      .then((data) => active && Array.isArray(data) && data.length && setLocales(data))
      .catch(() => undefined)
      .finally(() => active && setLoaded(true))
    return () => { active = false }
  }, [])

  return { locales, loaded }
}
